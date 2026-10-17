import { ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditLogService } from '../database/audit-log.service';
import { createEmptyStore, DataStore, Evidence } from '../database/types';
import { DbService } from '../database/db.service';
import { EvidenceService } from '../evidence/evidence.service';
import { ResourceRecordsService } from './resource-records.service';
import { ResourcesService } from '../resources/resources.service';
import { CalculationsService } from '../calculations/calculations.service';
import { ViewsService } from '../database/views.service';

describe('Enterprise Domain Features (GHG Protocol Assurance)', () => {
  let uploadDir: string;
  let originalUploadDir: string | undefined;
  let store: DataStore;
  let db: DbService;
  let service: ResourceRecordsService;
  let evidenceService: EvidenceService;
  let calculationsService: CalculationsService;
  let viewsService: ViewsService;
  let resourcesService: ResourcesService;

  const user = {
    sub: 'user-1',
    email: 'contributor@example.test',
    role: 'CONTRIBUTOR' as const,
    organizationId: 'org-1',
    departmentId: 'dept-1',
    isOwner: false,
  };

  beforeEach(() => {
    originalUploadDir = process.env.UPLOAD_DIR;
    uploadDir = mkdtempSync(join(tmpdir(), 'tropos-enterprise-'));
    process.env.UPLOAD_DIR = uploadDir;
    store = createEmptyStore();
    let idCounter = 0;
    db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => `id-${++idCounter}`),
      now: jest.fn(() => '2026-10-14T00:00:00.000Z'),
    } as unknown as DbService;

    // Seed active org and subscription
    store.organizations.push({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      status: 'ACTIVE',
      maintenanceMode: false,
      sessionTimeoutOverrideMin: null,
      carbonPricePerTon: 25,
      currency: 'USD',
      baselineYear: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    store.departments.push({
      id: 'dept-1',
      organizationId: 'org-1',
      name: 'Operations',
      description: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    store.locations.push({
      id: 'loc-1',
      departmentId: 'dept-1',
      name: 'HQ Facility',
      address: null,
      createdAt: '2026-01-01',
    });
    store.plans.push({
      id: 'plan-enterprise',
      name: 'Enterprise',
      maxDepartments: 50,
      maxUsers: 500,
      maxResourceTypes: 50,
      reportFrequency: 'MONTHLY',
      priceMonthly: 500,
      priceAnnual: 5000,
      isActive: true,
    });
    store.subscriptions.push({
      id: 'sub-1',
      organizationId: 'org-1',
      planId: 'plan-enterprise',
      status: 'ACTIVE',
      cycle: 'ANNUAL',
      startDate: '2026-01-01',
      renewalDate: '2027-01-01',
      cancelledAt: null,
      updatedAt: '2026-01-01',
    });
    store.resourceTypes.push({
      id: 'type-elec',
      name: 'Grid Electricity',
      category: 'ELECTRICITY',
      description: null,
      evidenceThreshold: 1000,
      units: [{ unit: 'kWh', isDefault: true }, { unit: 'MWh', isDefault: false }],
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    store.emissionFactorSources.push({
      id: 'source-epa',
      name: 'EPA eGRID 2026',
      publisher: 'US EPA',
      referenceUrl: null,
      createdAt: '2026-01-01',
    });
    store.emissionFactorVersions.push({
      id: 'factor-grid',
      resourceTypeId: 'type-elec',
      sourceId: 'source-epa',
      organizationId: null,
      gas: 'CO2',
      factorValue: 0.5, // 0.5 kg CO2e per kWh
      gwp: 1,
      unit: 'kWh',
      effectiveFrom: '2020-01-01',
      effectiveTo: null,
      isLocked: false,
      createdById: null,
      createdAt: '2026-01-01',
    });

    const auditLog = { log: jest.fn() } as unknown as AuditLogService;
    evidenceService = new EvidenceService(db, auditLog);
    calculationsService = new CalculationsService(db);
    viewsService = new ViewsService(db);
    resourcesService = new ResourcesService(db, auditLog);
    service = new ResourceRecordsService(
      db,
      auditLog,
      resourcesService,
      calculationsService,
      viewsService,
      evidenceService,
    );
  });

  afterEach(() => {
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    rmSync(uploadDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('Feature 1: Overlapping Meter Interval Detection & Guard', () => {
    it('prevents creating overlapping records for the same resource and location', () => {
      // 1. Create first valid entry: 2026-01-01 to 2026-01-31
      service.create(user, {
        resourceTypeId: 'type-elec',
        quantity: 500,
        unit: 'kWh',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        locationId: 'loc-1',
      });

      // 2. Attempt to create overlapping entry: 2026-01-15 to 2026-02-15
      expect(() => {
        service.create(user, {
          resourceTypeId: 'type-elec',
          quantity: 400,
          unit: 'kWh',
          periodStart: '2026-01-15',
          periodEnd: '2026-02-15',
          locationId: 'loc-1',
        });
      }).toThrow(ConflictException);
    });

    it('allows adjoining non-overlapping meter intervals', () => {
      // Entry 1: January
      service.create(user, {
        resourceTypeId: 'type-elec',
        quantity: 500,
        unit: 'kWh',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        locationId: 'loc-1',
      });

      // Entry 2: February (starts immediately next day)
      expect(() => {
        service.create(user, {
          resourceTypeId: 'type-elec',
          quantity: 450,
          unit: 'kWh',
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          locationId: 'loc-1',
        });
      }).not.toThrow();
    });
  });

  describe('Feature 3: Scope 2 Dual Reporting Engine (GHG Protocol Scope 2 Guidance)', () => {
    it('calculates 0 market emissions for electricity covered by Renewable Energy Certificates (RECs)', () => {
      const record = service.create(user, {
        resourceTypeId: 'type-elec',
        quantity: 1000,
        unit: 'kWh',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        locationId: 'loc-1',
        marketInstrument: 'REC',
      });

      const calc = calculationsService.calculateForRecord(record.id);

      // 1000 kWh * 0.5 = 500 kg location-based
      expect(calc!.co2eKg).toBe(500);
      expect(calc!.co2eLocationKg).toBe(500);
      // REC yields 0 kg market-based
      expect(calc!.co2eMarketKg).toBe(0);
    });

    it('calculates reduced market emissions for Green Tariff contracts', () => {
      const record = service.create(user, {
        resourceTypeId: 'type-elec',
        quantity: 1000,
        unit: 'kWh',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        locationId: 'loc-1',
        marketInstrument: 'GREEN_TARIFF',
      });

      const calc = calculationsService.calculateForRecord(record.id);

      expect(calc!.co2eLocationKg).toBe(500);
      // Green tariff retains only 10% residual grid emission
      expect(calc!.co2eMarketKg).toBe(50);
    });
  });

  describe('Feature 4: Cryptographic Evidence SHA-256 Hashing', () => {
    it('computes sha256Hash and verifies integrity on file attach', () => {
      const record = service.create(user, {
        resourceTypeId: 'type-elec',
        quantity: 200,
        unit: 'kWh',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
      });

      const pdfHeader = Buffer.from('%PDF-1.4 sample bill content for assurance testing');
      const expectedHash = createHash('sha256').update(pdfHeader).digest('hex');

      const mockFile = {
        fieldname: 'file',
        originalname: 'utility_bill_may2026.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: pdfHeader.length,
        buffer: pdfHeader,
      } as Express.Multer.File;

      const attached = evidenceService.attach(user, record.id, mockFile);
      expect(attached.sha256Hash).toBe(expectedHash);

      const download = evidenceService.resolveDownload(user, record.id, attached.id);
      expect(download.sha256Hash).toBe(expectedHash);
    });
  });

  describe('Feature 5: Automated Telemetry Ingestion Endpoint', () => {
    it('ingests smart meter telemetry, auto-submits, and calculates emissions immediately', () => {
      const result = service.ingestTelemetry(user, {
        deviceId: 'SMART-METER-HQ-01',
        resourceTypeId: 'type-elec',
        quantity: 1200,
        unit: 'kWh',
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        locationId: 'loc-1',
        autoSubmit: true,
      });

      expect(result.record.deviceId).toBe('SMART-METER-HQ-01');
      expect(result.record.status).toBe('SUBMITTED');
      expect(result.submission).toBeDefined();

      const calc = store.calculationResults.find((c) => c.resourceRecordId === result.record.id);
      expect(calc).toBeDefined();
      expect(calc?.co2eKg).toBe(600); // 1200 * 0.5
    });
  });
});
