import { CalculationsService } from './calculations.service';
import { DbService } from '../database/db.service';
import { createEmptyStore } from '../database/types';

describe('CalculationsService historical results', () => {
  it('retains a superseded calculation when a locked record is recalculated', () => {
    const store = createEmptyStore();
    let sequence = 0;
    const db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => `calculation-${++sequence}`),
      now: jest.fn(() => '2026-10-14T00:00:00.000Z'),
    } as unknown as DbService;
    store.organizations.push({ id: 'org-1', name: 'Org', slug: 'org', status: 'ACTIVE', maintenanceMode: false, sessionTimeoutOverrideMin: null, carbonPricePerTon: 0, currency: 'USD', baselineYear: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    store.resourceTypes.push({ id: 'type-1', name: 'Electricity', category: 'ELECTRICITY', description: null, evidenceThreshold: null, units: [{ unit: 'kWh', isDefault: true }], isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    store.emissionFactorSources.push({ id: 'source-1', name: 'Source', publisher: 'Publisher', referenceUrl: null, createdAt: '2026-01-01' });
    store.emissionFactorVersions.push({ id: 'factor-1', resourceTypeId: 'type-1', sourceId: 'source-1', organizationId: null, gas: 'CO2', factorValue: 2, gwp: 1, unit: 'kWh', effectiveFrom: '2020-01-01', effectiveTo: null, isLocked: false, createdById: null, createdAt: '2026-01-01' });
    store.resourceRecords.push({ id: 'record-1', organizationId: 'org-1', departmentId: 'department-1', locationId: null, resourceTypeId: 'type-1', quantity: 3, unit: 'kWh', cost: null, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null, status: 'LOCKED', evidenceRequirement: 'NOT_REQUIRED', createdById: 'user-1', submittedAt: null, lockedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' });

    const service = new CalculationsService(db);
    service.calculateForRecord('record-1');
    store.resourceRecords[0].quantity = 4;
    service.recalculate('record-1');

    expect(store.calculationResults).toHaveLength(2);
    expect(store.calculationResults.find((result) => result.supersededAt)?.co2eKg).toBe(6);
    expect(store.calculationResults.find((result) => !result.supersededAt)?.co2eKg).toBe(8);
  });
});
