import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../database/audit-log.service';
import { DbService } from '../database/db.service';
import { createEmptyStore, DataStore } from '../database/types';
import { AuthService } from './auth.service';

describe('AuthService maintenance mode login prevention', () => {
  let store: DataStore;
  let service: AuthService;
  const config = { get: jest.fn((key: string) => (key === 'BCRYPT_SALT_ROUNDS' ? 4 : 'test-secret')) } as unknown as ConfigService;
  const jwt = new JwtService({ secret: 'test-secret' });
  const audit = { log: jest.fn() } as unknown as AuditLogService;

  beforeEach(async () => {
    store = createEmptyStore();
    const db = {
      store,
      persist: jest.fn(),
      id: jest.fn(() => 'id-' + Math.random().toString(36).substring(2, 9)),
      now: jest.fn(() => '2026-10-17T00:00:00.000Z'),
    } as unknown as DbService;

    service = new AuthService(db, jwt, config, audit);

    // Seed test org & user
    const passwordHash = await bcrypt.hash('SecretPass1!', 4);
    store.organizations.push({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      status: 'ACTIVE',
      maintenanceMode: false,
      sessionTimeoutOverrideMin: null,
      carbonPricePerTon: 0,
      currency: 'USD',
      baselineYear: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });

    store.orgUsers.push({
      id: 'user-1',
      organizationId: 'org-1',
      email: 'user@test.org',
      passwordHash,
      fullName: 'Test User',
      role: 'CONTRIBUTOR',
      isOwner: false,
      isActive: true,
      departmentId: null,
      invitedById: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      lastLogin: null,
    });

    store.platformAdmins.push({
      id: 'admin-1',
      email: 'admin@platform.tropos',
      passwordHash,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      phone: null,
      jobTitle: null,
      invitedById: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      lastLogin: null,
    });
  });

  it('allows org user login when maintenance mode is off', async () => {
    store.platformSettings.maintenanceMode = false;
    const res = await service.loginOrgUser({ email: 'user@test.org', password: 'SecretPass1!' });
    expect(res.user.email).toBe('user@test.org');
    expect(res.token).toBeDefined();
  });

  it('blocks org user login with ServiceUnavailableException when platform maintenance mode is on', async () => {
    store.platformSettings.maintenanceMode = true;
    store.platformSettings.maintenanceMessage = 'Platform maintenance in progress.';

    await expect(
      service.loginOrgUser({ email: 'user@test.org', password: 'SecretPass1!' }),
    ).rejects.toThrow(ServiceUnavailableException);

    await expect(
      service.loginOrgUser({ email: 'user@test.org', password: 'SecretPass1!' }),
    ).rejects.toThrow('Platform maintenance in progress.');
  });

  it('blocks org user login when their specific organization is in maintenance mode', async () => {
    store.platformSettings.maintenanceMode = false;
    store.organizations[0].maintenanceMode = true;

    await expect(
      service.loginOrgUser({ email: 'user@test.org', password: 'SecretPass1!' }),
    ).rejects.toThrow(ServiceUnavailableException);

    await expect(
      service.loginOrgUser({ email: 'user@test.org', password: 'SecretPass1!' }),
    ).rejects.toThrow('Your organization is currently in maintenance mode. Please try again shortly.');
  });

  it('still permits platform admins to log in during platform maintenance mode', async () => {
    store.platformSettings.maintenanceMode = true;
    const res = await service.loginPlatformAdmin({ email: 'admin@platform.tropos', password: 'SecretPass1!' });
    expect(res.user.email).toBe('admin@platform.tropos');
    expect(res.token).toBeDefined();
  });

  it('returns public maintenance status correctly', () => {
    store.platformSettings.maintenanceMode = true;
    store.platformSettings.maintenanceMessage = 'Upgrade in progress.';
    expect(service.getMaintenanceStatus()).toEqual({
      maintenanceMode: true,
      message: 'Upgrade in progress.',
    });

    store.platformSettings.maintenanceMode = false;
    store.platformSettings.maintenanceMessage = null;
    expect(service.getMaintenanceStatus()).toEqual({
      maintenanceMode: false,
      message: null,
    });
  });
});
