import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingService } from '../billing/billing.service';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore } from '../database/types';
import { ViewsService } from '../database/views.service';
import { ImportsService } from '../imports/imports.service';
import { ReportsService } from '../reports/reports.service';

describe('organization reporting, import, analytics, and billing isolation', () => {
  let store: DataStore;
  let db: Pick<DbService, 'store' | 'persist' | 'id' | 'now'>;
  let reports: ReportsService;
  let analytics: AnalyticsService;
  let imports: ImportsService;
  let billing: BillingService;

  const orgAUser = {
    sub: 'user-a', email: 'a@example.test', role: 'ORG_ADMIN' as const, organizationId: 'org-a', departmentId: null, isOwner: true,
  };
  beforeEach(() => {
    store = createEmptyStore();
    db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => 'created-id'),
      now: jest.fn(() => '2026-10-14T00:00:00.000Z'),
    };
    const auditLog = { log: jest.fn() } as unknown as AuditLogService;
    const views = {
      report: (report: unknown) => report,
      record: (record: unknown) => record,
    } as ViewsService;
    reports = new ReportsService(db as DbService, auditLog, views);
    analytics = new AnalyticsService(db as DbService, views);
    imports = new ImportsService(db as DbService, auditLog, {} as never);
    billing = new BillingService(db as DbService, auditLog);

    store.departments.push(
      { id: 'department-a', organizationId: 'org-a', name: 'A', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'department-b', organizationId: 'org-b', name: 'B', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.reports.push(
      { id: 'report-a', organizationId: 'org-a', title: 'A', periodStart: '2026-01-01', periodEnd: '2026-01-31', notes: null, contentJson: {}, pdfFilePath: null, status: 'DRAFT', version: 1, createdById: 'user-a', approvedById: null, approvalComment: null, approvedAt: null, supersedesId: null, isScheduled: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'report-b', organizationId: 'org-b', title: 'B', periodStart: '2026-01-01', periodEnd: '2026-01-31', notes: null, contentJson: {}, pdfFilePath: null, status: 'DRAFT', version: 1, createdById: 'user-b', approvedById: null, approvalComment: null, approvedAt: null, supersedesId: null, isScheduled: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.importBatches.push(
      { id: 'batch-a', organizationId: 'org-a', initiatedById: 'user-a', fileName: 'a.csv', totalRows: 1, successRows: 1, errorRows: 0, errorsJson: null, status: 'completed', createdAt: '2026-01-01', completedAt: '2026-01-01' },
      { id: 'batch-b', organizationId: 'org-b', initiatedById: 'user-b', fileName: 'b.csv', totalRows: 1, successRows: 1, errorRows: 0, errorsJson: null, status: 'completed', createdAt: '2026-01-01', completedAt: '2026-01-01' },
    );
  });

  it('keeps reports and import batches inaccessible across organization IDs', () => {
    expect(reports.findAll(orgAUser).map((report) => report.id)).toEqual(['report-a']);
    expect(() => reports.findOne(orgAUser, 'report-b')).toThrow(NotFoundException);
    expect(() => reports.update(orgAUser, 'report-b', { title: 'Changed' })).toThrow(NotFoundException);
    expect(() => reports.remove(orgAUser, 'report-b')).toThrow(NotFoundException);
    expect(imports.findAll(orgAUser).map((batch) => batch.id)).toEqual(['batch-a']);
    expect(() => imports.findOne(orgAUser, 'batch-b')).toThrow(NotFoundException);
  });

  it('aggregates analytics and targets only from the authenticated organization', () => {
    store.resourceRecords.push(
      { id: 'record-a', organizationId: 'org-a', departmentId: 'department-a', locationId: null, resourceTypeId: 'type', quantity: 2, unit: 'kWh', cost: 3, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null, status: 'LOCKED', evidenceRequirement: 'NOT_REQUIRED', createdById: 'user-a', submittedAt: null, lockedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'record-b', organizationId: 'org-b', departmentId: 'department-b', locationId: null, resourceTypeId: 'type', quantity: 200, unit: 'kWh', cost: 300, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null, status: 'LOCKED', evidenceRequirement: 'NOT_REQUIRED', createdById: 'user-b', submittedAt: null, lockedAt: '2026-01-01', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.calculationResults.push(
      { id: 'calc-a', resourceRecordId: 'record-a', factorVersionId: 'factor', co2eKg: 4, costOfUsage: 3, savingsVsBaseline: null, carbonExposure: null, calculatedAt: '2026-01-01', recalculatedCount: 0 },
      { id: 'calc-b', resourceRecordId: 'record-b', factorVersionId: 'factor', co2eKg: 400, costOfUsage: 300, savingsVsBaseline: null, carbonExposure: null, calculatedAt: '2026-01-01', recalculatedCount: 0 },
    );
    const result = analytics.emissions(orgAUser, {});
    expect(result.totals).toEqual({ co2eKg: 4, cost: 3, entries: 1 });
    expect(result.departments.map((department) => department.departmentId)).toEqual(['department-a']);
    expect(analytics.emissions(orgAUser, { departmentId: 'department-b' }).departments).toEqual([]);
  });

  it('returns and changes only the caller organization subscription and invoice data', () => {
    store.plans.push(
      { id: 'plan-a', name: 'A', maxDepartments: 5, maxUsers: 5, maxResourceTypes: 5, reportFrequency: 'monthly', priceMonthly: 10, priceAnnual: 100, isActive: true },
      { id: 'plan-b', name: 'B', maxDepartments: 5, maxUsers: 5, maxResourceTypes: 5, reportFrequency: 'monthly', priceMonthly: 20, priceAnnual: 200, isActive: true },
    );
    store.subscriptions.push(
      { id: 'subscription-a', organizationId: 'org-a', planId: 'plan-a', status: 'ACTIVE', cycle: 'MONTHLY', startDate: '2026-01-01', renewalDate: null, cancelledAt: null, updatedAt: '2026-01-01' },
      { id: 'subscription-b', organizationId: 'org-b', planId: 'plan-a', status: 'ACTIVE', cycle: 'MONTHLY', startDate: '2026-01-01', renewalDate: null, cancelledAt: null, updatedAt: '2026-01-01' },
    );
    store.invoices.push(
      { id: 'invoice-a', organizationId: 'org-a', subscriptionId: 'subscription-a', amount: 10, currency: 'USD', status: 'mock_paid', issuedAt: '2026-01-01', periodStart: '2026-01-01', periodEnd: '2026-01-31' },
      { id: 'invoice-b', organizationId: 'org-b', subscriptionId: 'subscription-b', amount: 10, currency: 'USD', status: 'mock_paid', issuedAt: '2026-01-01', periodStart: '2026-01-01', periodEnd: '2026-01-31' },
    );
    expect(billing.getMySubscription(orgAUser).id).toBe('subscription-a');
    expect(billing.getMyInvoices(orgAUser).map((invoice) => invoice.id)).toEqual(['invoice-a']);
    billing.changePlan(orgAUser, { planId: 'plan-b' });
    expect(store.subscriptions.find((subscription) => subscription.id === 'subscription-a')?.planId).toBe('plan-b');
    expect(store.subscriptions.find((subscription) => subscription.id === 'subscription-b')?.planId).toBe('plan-a');
    expect(store.invoices.filter((invoice) => invoice.organizationId === 'org-b')).toHaveLength(1);
  });
});
