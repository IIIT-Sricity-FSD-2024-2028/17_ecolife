import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore, SubmissionStatus } from '../database/types';
import { ResourceRecordsService } from '../resource-records/resource-records.service';

describe('resource-record submission and review authorization', () => {
  let store: DataStore;
  let service: ResourceRecordsService;
  const contributorA = { sub: 'contributor-a', email: 'a@test', role: 'CONTRIBUTOR' as const, organizationId: 'org-a', departmentId: 'department-a', isOwner: false };
  const contributorAOther = { ...contributorA, sub: 'contributor-a-other' };
  const reviewerA = { ...contributorA, sub: 'reviewer-a', role: 'REVIEWER' as const, departmentId: null };
  const reviewerB = { ...reviewerA, sub: 'reviewer-b', organizationId: 'org-b' };

  const addRecord = (id: string, organizationId: string, createdById: string, status: SubmissionStatus = 'DRAFT') => {
    store.resourceRecords.push({
      id, organizationId, departmentId: organizationId === 'org-a' ? 'department-a' : 'department-b', locationId: null,
      resourceTypeId: 'type', quantity: 1, unit: 'kWh', cost: null, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null,
      status, evidenceRequirement: 'NOT_REQUIRED', createdById, submittedAt: status === 'SUBMITTED' ? '2026-01-01' : null,
      lockedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    });
    if (status === 'SUBMITTED') {
      store.submissions.push({ id: `submission-${id}`, resourceRecordId: id, organizationId, departmentId: organizationId === 'org-a' ? 'department-a' : 'department-b', status: 'SUBMITTED', reviewedById: null, reviewComment: null, reviewedAt: null, version: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    }
  };

  beforeEach(() => {
    store = createEmptyStore();
    const db = { store, persist: jest.fn(), id: jest.fn(() => 'created'), now: jest.fn(() => '2026-10-14T00:00:00.000Z') };
    const audit = { log: jest.fn() } as unknown as AuditLogService;
    service = new ResourceRecordsService(
      db as unknown as DbService, audit, {} as never, {} as never,
      { record: (record: unknown) => record } as never,
      { deleteFilesForRecord: jest.fn() } as never,
    );
  });

  it('denies cross-organization direct IDs for reads, submissions, review claims, and review decisions', () => {
    addRecord('record-b', 'org-b', 'contributor-b', 'SUBMITTED');
    expect(() => service.findOne(contributorA, 'record-b')).toThrow(NotFoundException);
    expect(() => service.submit(contributorA, 'record-b')).toThrow(NotFoundException);
    expect(() => service.claim(reviewerB, 'record-b')).not.toThrow();
    expect(() => service.claim(reviewerA, 'record-b')).toThrow(NotFoundException);
    expect(() => service.requestChanges(reviewerA, 'record-b', { comment: 'no' })).toThrow(NotFoundException);
  });

  it('enforces contributor ownership and reviewer segregation of duties', () => {
    addRecord('record-a', 'org-a', contributorA.sub);
    expect(() => service.update(contributorAOther, 'record-a', {})).toThrow(ForbiddenException);
    expect(() => service.deleteDraft(contributorAOther, 'record-a')).toThrow(ForbiddenException);
    expect(() => service.submit(contributorAOther, 'record-a')).toThrow(ForbiddenException);

    addRecord('submitted-own', 'org-a', reviewerA.sub, 'SUBMITTED');
    expect(() => service.claim(reviewerA, 'submitted-own')).toThrow(ForbiddenException);
    expect(() => service.reject(reviewerA, 'submitted-own', { comment: 'self review' })).toThrow(ForbiddenException);
  });

  it('retains submitted history on withdrawal and only physically deletes never-submitted drafts', () => {
    addRecord('draft-a', 'org-a', contributorA.sub);
    addRecord('submitted-a', 'org-a', contributorA.sub, 'SUBMITTED');
    store.comments.push({ id: 'comment-a', organizationId: 'org-a', entityType: 'resource_record', entityId: 'submitted-a', authorId: contributorA.sub, authorRole: 'CONTRIBUTOR', body: 'history', createdAt: '2026-01-01' });
    store.evidence.push({ id: 'evidence-a', resourceRecordId: 'submitted-a', fileName: 'proof.pdf', filePath: 'retained-path', mimeType: 'application/pdf', fileSizeBytes: 1, uploadedById: contributorA.sub, uploadedAt: '2026-01-01' });

    expect(() => service.deleteDraft(contributorA, 'submitted-a')).toThrow(BadRequestException);
    const withdrawn = service.withdraw(contributorA, 'submitted-a', { reason: 'Entered against the wrong meter.' });
    expect(withdrawn.status).toBe('WITHDRAWN');
    expect(withdrawn.withdrawalReason).toBe('Entered against the wrong meter.');
    expect(store.submissions.find((item) => item.resourceRecordId === 'submitted-a')?.status).toBe('WITHDRAWN');
    expect(store.comments).toHaveLength(1);
    expect(store.evidence).toHaveLength(1);
    expect(() => service.deleteDraft(contributorA, 'submitted-a')).toThrow(BadRequestException);

    // Records can only be deleted if in DRAFT status — REJECTED, CHANGES_REQUESTED, APPROVED must be rejected
    addRecord('rejected-a', 'org-a', contributorA.sub, 'REJECTED');
    expect(() => service.deleteDraft(contributorA, 'rejected-a')).toThrow(BadRequestException);

    addRecord('changes-a', 'org-a', contributorA.sub, 'CHANGES_REQUESTED');
    expect(() => service.deleteDraft(contributorA, 'changes-a')).toThrow(BadRequestException);

    addRecord('approved-a', 'org-a', contributorA.sub, 'APPROVED');
    expect(() => service.deleteDraft(contributorA, 'approved-a')).toThrow(BadRequestException);
  });
});
