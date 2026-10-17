import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createEmptyStore } from '../database/types';

// This project has supertest installed but no @types/supertest dependency.
// Keep the integration harness dependency-neutral rather than changing packages.
const request: any = require('supertest');

describe('organization HTTP authorization guards', () => {
  let app: INestApplication;
  let tempDir: string;
  let previousDataFile: string | undefined;
  let previousJwtSecret: string | undefined;
  let previousAdminSecret: string | undefined;
  const secret = 'org-integration-secret-only-for-isolated-test';
  const ids = {
    orgA: '11111111-1111-4111-8111-111111111111',
    orgB: '22222222-2222-4222-8222-222222222222',
    adminA: '33333333-3333-4333-8333-333333333333',
    contributorA: '44444444-4444-4444-8444-444444444444',
    adminB: '55555555-5555-4555-8555-555555555555',
    departmentA: '66666666-6666-4666-8666-666666666666',
    departmentB: '77777777-7777-4777-8777-777777777777',
  };

  beforeAll(async () => {
    previousDataFile = process.env.TROPOS_DATA_FILE;
    previousJwtSecret = process.env.JWT_SECRET;
    previousAdminSecret = process.env.JWT_ADMIN_SECRET;
    tempDir = mkdtempSync(join(tmpdir(), 'tropos-http-auth-'));
    process.env.TROPOS_DATA_FILE = join(tempDir, 'store.json');
    process.env.JWT_SECRET = secret;
    process.env.JWT_ADMIN_SECRET = 'different-admin-integration-secret-only-for-test';

    const store = createEmptyStore();
    store.organizations.push(
      { id: ids.orgA, name: 'Org A', slug: 'org-a', status: 'ACTIVE', maintenanceMode: false, sessionTimeoutOverrideMin: null, carbonPricePerTon: 0, currency: 'USD', baselineYear: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: ids.orgB, name: 'Org B', slug: 'org-b', status: 'ACTIVE', maintenanceMode: false, sessionTimeoutOverrideMin: null, carbonPricePerTon: 0, currency: 'USD', baselineYear: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    store.departments.push(
      { id: ids.departmentA, organizationId: ids.orgA, name: 'A', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: ids.departmentB, organizationId: ids.orgB, name: 'B', description: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    );
    const user = (id: string, organizationId: string, role: 'ORG_ADMIN' | 'CONTRIBUTOR', departmentId: string | null, isOwner: boolean) => ({
      id, organizationId, email: `${id}@test.invalid`, passwordHash: 'not-used', fullName: id, role, isOwner, isActive: true, departmentId, invitedById: null, createdAt: '2026-01-01', updatedAt: '2026-01-01', lastLogin: null,
    });
    store.orgUsers.push(user(ids.adminA, ids.orgA, 'ORG_ADMIN', null, true), user(ids.contributorA, ids.orgA, 'CONTRIBUTOR', ids.departmentA, false), user(ids.adminB, ids.orgB, 'ORG_ADMIN', null, true));
    writeFileSync(process.env.TROPOS_DATA_FILE, JSON.stringify(store));

    const { AppModule } = require('../app.module') as typeof import('../app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    // DbService shutdown schedules its existing 150 ms debounced persistence
    // write. Let that isolated write finish before removing the temp folder.
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (previousDataFile === undefined) delete process.env.TROPOS_DATA_FILE; else process.env.TROPOS_DATA_FILE = previousDataFile;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousJwtSecret;
    if (previousAdminSecret === undefined) delete process.env.JWT_ADMIN_SECRET; else process.env.JWT_ADMIN_SECRET = previousAdminSecret;
    rmSync(tempDir, { recursive: true, force: true });
  });

  const token = (sub: string) => new JwtService({ secret }).sign({ sub, email: `${sub}@forged.invalid`, role: 'ORG_ADMIN', organizationId: ids.orgB });

  it('requires a valid session and derives authorization from persisted membership rather than JWT claims', async () => {
    await request(app.getHttpServer()).get('/departments').expect(401);
    const response = await request(app.getHttpServer()).get('/departments').set('Authorization', `Bearer ${token(ids.contributorA)}`).expect(200);
    expect(response.body.map((department: { id: string }) => department.id)).toEqual([ids.departmentA]);
  });

  it('enforces controller roles and returns non-disclosing cross-organization direct-ID responses', async () => {
    await request(app.getHttpServer()).get('/org-users').set('Authorization', `Bearer ${token(ids.contributorA)}`).expect(403);
    await request(app.getHttpServer()).get(`/departments/${ids.departmentB}`).set('Authorization', `Bearer ${token(ids.adminA)}`).expect(404);
  });
});
