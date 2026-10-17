import { AmendmentsService } from './amendments.service';
import { DbService } from '../database/db.service';
import { createEmptyStore } from '../database/types';

describe('AmendmentsService report revisions', () => {
  it('keeps an approved report immutable and creates one linked draft revision for a material correction', () => {
    const store = createEmptyStore();
    let sequence = 0;
    const db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => `generated-${++sequence}`),
      now: jest.fn(() => '2026-10-14T00:00:00.000Z'),
    } as unknown as DbService;
    store.resourceRecords.push({
      id: 'record-1', organizationId: 'org-1', departmentId: 'department-1', locationId: null,
      resourceTypeId: 'type-1', quantity: 100, unit: 'kWh', cost: null,
      periodStart: '2026-01-01', periodEnd: '2026-01-31', notes: null, status: 'LOCKED',
      evidenceRequirement: 'NOT_REQUIRED', createdById: 'contributor-1', submittedAt: '2026-01-31',
      lockedAt: '2026-02-01', createdAt: '2026-01-01', updatedAt: '2026-02-01',
    });
    store.amendments.push({
      id: 'amendment-1', resourceRecordId: 'record-1', status: 'PENDING_APPROVAL', reason: 'Corrected meter read.',
      originalQuantity: 100, originalCost: null, proposedQuantity: 120, proposedCost: null,
      materialityPercent: 20, triggersBaselineRecalc: true, proposedById: 'reviewer-1', approvedById: null,
      approvalComment: null, createdAt: '2026-10-01', resolvedAt: null,
    });
    const approved = {
      id: 'report-1', organizationId: 'org-1', title: 'January report', periodStart: '2026-01-01', periodEnd: '2026-01-31',
      notes: 'Original approved notes', contentJson: { total: 100 }, pdfFilePath: 'approved.pdf', status: 'APPROVED' as const,
      version: 1, createdById: 'reviewer-1', approvedById: 'executive-0', approvalComment: 'Approved.',
      approvedAt: '2026-02-02', supersedesId: null, isScheduled: false, createdAt: '2026-02-01', updatedAt: '2026-02-02',
    };
    store.reports.push(approved);
    const audit = { log: jest.fn() } as never;
    const calculations = { recalculate: jest.fn() } as never;
    const service = new AmendmentsService(db, audit, calculations, {} as never);
    const executive = { sub: 'executive-1', email: 'executive@example.test', role: 'EXECUTIVE' as const, organizationId: 'org-1', departmentId: null, isOwner: false };

    service.approve(executive, 'amendment-1', {});

    expect(store.reports).toHaveLength(2);
    expect(store.reports[0]).toEqual(approved);
    expect(store.reports[1]).toMatchObject({
      organizationId: 'org-1', status: 'DRAFT', version: 2, supersedesId: 'report-1',
      contentJson: { total: 100 }, pdfFilePath: null,
    });

  });
});
