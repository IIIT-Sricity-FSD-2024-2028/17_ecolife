import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore, Department, Location, OrgUser } from '../database/types';
import { DepartmentsService } from '../departments/departments.service';
import { LocationsService } from '../locations/locations.service';
import { OrgUsersService } from '../org-users/org-users.service';

describe('organization administration isolation', () => {
  let store: DataStore;
  let db: Pick<DbService, 'store' | 'persist' | 'id' | 'now'>;
  let users: OrgUsersService;
  let departments: DepartmentsService;
  let locations: LocationsService;

  const orgAAdmin = {
    sub: 'user-a-admin',
    email: 'admin-a@example.test',
    role: 'ORG_ADMIN' as const,
    organizationId: 'org-a',
    departmentId: null,
    isOwner: true,
  };
  const orgBAdmin = { ...orgAAdmin, sub: 'user-b-admin', email: 'admin-b@example.test', organizationId: 'org-b' };

  const makeDepartment = (id: string, organizationId: string): Department => ({
    id,
    organizationId,
    name: `Department ${id}`,
    description: null,
    createdAt: '2026-10-14T00:00:00.000Z',
    updatedAt: '2026-10-14T00:00:00.000Z',
  });

  const makeUser = (id: string, organizationId: string, departmentId: string | null): OrgUser => ({
    id,
    organizationId,
    email: `${id}@example.test`,
    passwordHash: 'not-a-real-hash',
    fullName: id,
    role: 'CONTRIBUTOR',
    isOwner: false,
    isActive: true,
    departmentId,
    invitedById: null,
    createdAt: '2026-10-14T00:00:00.000Z',
    updatedAt: '2026-10-14T00:00:00.000Z',
    lastLogin: null,
  });

  const makeLocation = (id: string, departmentId: string): Location => ({
    id,
    departmentId,
    name: `Location ${id}`,
    address: null,
    createdAt: '2026-10-14T00:00:00.000Z',
  });

  beforeEach(() => {
    store = createEmptyStore();
    db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => 'created-id'),
      now: jest.fn(() => '2026-10-14T00:00:00.000Z'),
    };
    const auditLog = { log: jest.fn() } as unknown as AuditLogService;
    users = new OrgUsersService(db as DbService, auditLog);
    departments = new DepartmentsService(db as DbService, auditLog);
    locations = new LocationsService(db as DbService, auditLog);
    store.departments.push(makeDepartment('department-a', 'org-a'), makeDepartment('department-b', 'org-b'));
    store.orgUsers.push(makeUser('user-a-contributor', 'org-a', 'department-a'), makeUser('user-b-contributor', 'org-b', 'department-b'));
    store.locations.push(makeLocation('location-a', 'department-a'), makeLocation('location-b', 'department-b'));
  });

  it('lists only organization members and rejects cross-organization user IDs or departments', () => {
    expect(users.findAll(orgAAdmin).map((user) => user.id)).toEqual(['user-a-contributor']);
    expect(() => users.findOne(orgAAdmin, 'user-b-contributor')).toThrow(NotFoundException);
    expect(() => users.update(orgAAdmin, 'user-b-contributor', { isActive: false })).toThrow(NotFoundException);
    expect(() => users.update(orgAAdmin, 'user-a-contributor', { departmentId: 'department-b' })).toThrow(BadRequestException);
    expect(store.orgUsers.find((user) => user.id === 'user-a-contributor')?.departmentId).toBe('department-a');
  });

  it('keeps department reads and mutations inside the authenticated organization', () => {
    expect(departments.findAll(orgAAdmin).map((department) => department.id)).toEqual(['department-a']);
    expect(() => departments.findOne(orgAAdmin, 'department-b')).toThrow(NotFoundException);
    expect(() => departments.update(orgAAdmin, 'department-b', { name: 'Changed' })).toThrow(NotFoundException);
    expect(() => departments.remove(orgAAdmin, 'department-b')).toThrow(NotFoundException);
    expect(departments.create(orgAAdmin, { name: 'Operations' }).organizationId).toBe('org-a');
  });

  it('uses the parent department for location list, direct-ID, create, update, and delete isolation', () => {
    expect(locations.findAll(orgAAdmin).map((location) => location.id)).toEqual(['location-a']);
    expect(locations.findAll(orgAAdmin, 'department-b')).toEqual([]);
    expect(() => locations.findOne(orgAAdmin, 'location-b')).toThrow(NotFoundException);
    expect(() => locations.create(orgAAdmin, { departmentId: 'department-b', name: 'Foreign' })).toThrow(BadRequestException);
    expect(() => locations.update(orgAAdmin, 'location-b', { name: 'Changed' })).toThrow(NotFoundException);
    expect(() => locations.remove(orgAAdmin, 'location-b')).toThrow(NotFoundException);

    const created = locations.create(orgAAdmin, { departmentId: 'department-a', name: 'Allowed' });
    expect(created.departmentId).toBe('department-a');
    expect(created.id).toBe('created-id');
    expect(locations.findAll(orgBAdmin).map((location) => location.id)).toEqual(['location-b']);
  });
});
