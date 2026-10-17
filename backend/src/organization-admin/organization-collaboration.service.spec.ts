import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { AnnouncementsService } from '../announcements/announcements.service';
import { AuditLogsReadService } from '../audit-logs/audit-logs.service';
import { CommentsService } from '../comments/comments.service';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore } from '../database/types';
import { ViewsService } from '../database/views.service';

describe('organization collaboration and audit isolation', () => {
  let store: DataStore;
  let db: Pick<DbService, 'store' | 'persist' | 'id' | 'now'>;
  let comments: CommentsService;
  let alerts: AlertsService;
  let announcements: AnnouncementsService;
  let auditLogs: AuditLogsReadService;
  const contributorA = { sub: 'user-a', email: 'a@test', role: 'CONTRIBUTOR' as const, organizationId: 'org-a', departmentId: 'department-a', isOwner: false };
  const contributorB = { ...contributorA, sub: 'user-b', organizationId: 'org-b', departmentId: 'department-b' };
  const adminA = { ...contributorA, sub: 'admin-a', role: 'ORG_ADMIN' as const, departmentId: null, isOwner: true };

  beforeEach(() => {
    store = createEmptyStore();
    db = { store, persist: jest.fn(), id: jest.fn(() => 'created-id'), now: jest.fn(() => '2026-10-14T00:00:00.000Z') };
    const audit = { log: jest.fn() } as unknown as AuditLogService;
    const views = { alert: (alert: unknown) => alert } as ViewsService;
    comments = new CommentsService(db as DbService, audit);
    alerts = new AlertsService(db as DbService, audit, views);
    announcements = new AnnouncementsService(db as DbService, audit);
    auditLogs = new AuditLogsReadService(db as DbService);
    store.departments.push(
      { id: 'department-a', organizationId: 'org-a', name: 'A', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'department-b', organizationId: 'org-b', name: 'B', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.resourceRecords.push(
      { id: 'record-a', organizationId: 'org-a', departmentId: 'department-a', locationId: null, resourceTypeId: 'type', quantity: 1, unit: 'kWh', cost: null, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null, status: 'DRAFT', evidenceRequirement: 'NOT_REQUIRED', createdById: 'user-a', submittedAt: null, lockedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 'record-b', organizationId: 'org-b', departmentId: 'department-b', locationId: null, resourceTypeId: 'type', quantity: 1, unit: 'kWh', cost: null, periodStart: '2026-01-01', periodEnd: '2026-01-01', notes: null, status: 'DRAFT', evidenceRequirement: 'NOT_REQUIRED', createdById: 'user-b', submittedAt: null, lockedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.alerts.push(
      { id: 'alert-a', organizationId: 'org-a', severity: 'WARNING', status: 'OPEN', type: 'test', message: 'A', relatedResourceRecordId: 'record-a', relatedDepartmentId: 'department-a', createdAt: '2026-01-01' },
      { id: 'alert-b', organizationId: 'org-b', severity: 'WARNING', status: 'OPEN', type: 'test', message: 'B', relatedResourceRecordId: 'record-b', relatedDepartmentId: 'department-b', createdAt: '2026-01-01' },
    );
    store.auditLogs.push(
      { id: 'log-a', organizationId: 'org-a', orgUserId: 'user-a', platformAdminId: null, action: 'a', entityType: 'record', entityId: 'record-a', metadata: null, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'log-b', organizationId: 'org-b', orgUserId: 'user-b', platformAdminId: null, action: 'b', entityType: 'record', entityId: 'record-b', metadata: null, createdAt: '2026-01-01T00:00:00.000Z' },
    );
  });

  it('rejects cross-organization comment and alert access', () => {
    expect(() => comments.list(contributorA, { entityType: 'resource_record', entityId: 'record-b' })).toThrow(NotFoundException);
    expect(() => comments.create(contributorA, { entityType: 'resource_record', entityId: 'record-b', body: 'no' })).toThrow(NotFoundException);
    expect(alerts.findAll(contributorA).map((alert) => (alert as { id: string }).id)).toEqual(['alert-a']);
    expect(() => alerts.respond(contributorA, 'alert-b', { responseText: 'no', action: 'fixed' })).toThrow(NotFoundException);
  });

  it('keeps announcements and audit-log reads organization-scoped', () => {
    expect(() => announcements.create(adminA, { title: 'bad', body: 'bad', departmentId: 'department-b' })).toThrow(BadRequestException);
    announcements.create(adminA, { title: 'ok', body: 'ok', departmentId: 'department-a', expiresInDays: 1 });
    expect(announcements.list(contributorA)).toHaveLength(1);
    expect(announcements.list(contributorB)).toHaveLength(0);
    expect(auditLogs.forOrganization('org-a', {}).items.map((item) => item.id)).toEqual(['log-a']);
    expect(auditLogs.actionsFor('org-a')).toEqual(['a']);
  });
});
