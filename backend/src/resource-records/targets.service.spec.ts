import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore } from '../database/types';
import { TargetsService } from './targets.service';

describe('TargetsService organization isolation', () => {
  let store: DataStore;
  let service: TargetsService;
  const reviewer = {
    sub: 'reviewer-a', email: 'reviewer-a@example.test', role: 'REVIEWER' as const,
    organizationId: 'org-a', departmentId: 'dept-a', isOwner: false,
  };

  beforeEach(() => {
    store = createEmptyStore();
    const db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => 'target-a'),
      now: jest.fn(() => '2026-01-01T00:00:00.000Z'),
    } as unknown as DbService;
    service = new TargetsService(db, { log: jest.fn() } as unknown as AuditLogService);
    store.departments.push(
      { id: 'dept-a', organizationId: 'org-a', name: 'A', description: null, createdAt: '', updatedAt: '' },
      { id: 'dept-b', organizationId: 'org-b', name: 'B', description: null, createdAt: '', updatedAt: '' },
    );
  });

  const dto = { targetValue: 10, metric: 'emissions', periodStart: '2026-01-01', periodEnd: '2026-12-31' };

  it('permits a target for a department in the reviewer organization', () => {
    const target = service.create(reviewer, { ...dto, departmentId: 'dept-a' });
    expect(target.departmentId).toBe('dept-a');
    expect(target.organizationId).toBe('org-a');
  });

  it('rejects cross-organization department ids on create and update', () => {
    expect(() => service.create(reviewer, { ...dto, departmentId: 'dept-b' })).toThrow(BadRequestException);
    const target = service.create(reviewer, { ...dto, departmentId: 'dept-a' });
    expect(() => service.update(reviewer, target.id, { departmentId: 'dept-b' })).toThrow(BadRequestException);
    expect(target.departmentId).toBe('dept-a');
  });

  it('does not expose a target from another organization by id', () => {
    store.targets.push({
      id: 'target-b', organizationId: 'org-b', name: null, notes: null, departmentId: 'dept-b', resourceCategory: null,
      targetValue: 1, metric: 'emissions', periodStart: '2026-01-01', periodEnd: '2026-12-31', createdById: 'reviewer-b', createdAt: '', updatedAt: '',
    });
    expect(() => service.findOne(reviewer, 'target-b')).toThrow(NotFoundException);
  });
});
