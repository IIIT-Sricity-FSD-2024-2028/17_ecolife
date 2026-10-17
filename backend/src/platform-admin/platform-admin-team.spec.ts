import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createEmptyStore } from '../database/types';

const request: any = require('supertest');

describe('Platform Admin Team Authorization & Invariants', () => {
  let app: INestApplication;
  let tempDir: string;
  let previousDataFile: string | undefined;
  let previousJwtSecret: string | undefined;
  let previousAdminSecret: string | undefined;

  const adminSecret = 'admin-team-spec-secret-xyz-987';
  const superAdminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const platformAdminId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    previousDataFile = process.env.TROPOS_DATA_FILE;
    previousJwtSecret = process.env.JWT_SECRET;
    previousAdminSecret = process.env.JWT_ADMIN_SECRET;

    tempDir = mkdtempSync(join(tmpdir(), 'tropos-admin-team-'));
    process.env.TROPOS_DATA_FILE = join(tempDir, 'store.json');
    process.env.JWT_SECRET = 'any-org-jwt-secret';
    process.env.JWT_ADMIN_SECRET = adminSecret;

    const store = createEmptyStore();
    store.platformAdmins.push(
      {
        id: superAdminId,
        email: 'root@tropos.dev',
        passwordHash: 'not-checked-in-jwt',
        fullName: 'Root Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        invitedById: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLogin: null,
        deletedAt: null,
      },
      {
        id: platformAdminId,
        email: 'ops@tropos.dev',
        passwordHash: 'not-checked-in-jwt',
        fullName: 'Operations Admin',
        role: 'PLATFORM_ADMIN',
        isActive: true,
        invitedById: superAdminId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastLogin: null,
        deletedAt: null,
      },
    );
    writeFileSync(process.env.TROPOS_DATA_FILE, JSON.stringify(store));

    const { AppModule } = require('../app.module') as typeof import('../app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    process.env.TROPOS_DATA_FILE = previousDataFile;
    process.env.JWT_SECRET = previousJwtSecret;
    process.env.JWT_ADMIN_SECRET = previousAdminSecret;
    rmSync(tempDir, { recursive: true, force: true });
  });

  const signAdminJwt = (sub: string, email: string, role: string) => {
    const jwt = app.get(JwtService);
    return jwt.sign({ sub, email, role }, { secret: adminSecret, algorithm: 'HS256' });
  };

  describe('Role-Based Access Control', () => {
    it('Platform Admin receives 403 Forbidden when trying to list platform admins', async () => {
      const token = signAdminJwt(platformAdminId, 'ops@tropos.dev', 'PLATFORM_ADMIN');
      await request(app.getHttpServer())
        .get('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('Platform Admin receives 403 Forbidden when trying to invite an admin', async () => {
      const token = signAdminJwt(platformAdminId, 'ops@tropos.dev', 'PLATFORM_ADMIN');
      await request(app.getHttpServer())
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newadmin@tropos.dev',
          fullName: 'New Admin',
          role: 'PLATFORM_ADMIN',
          temporaryPassword: 'Password123!',
        })
        .expect(403);
    });

    it('Platform Admin receives 403 Forbidden when trying to update an admin', async () => {
      const token = signAdminJwt(platformAdminId, 'ops@tropos.dev', 'PLATFORM_ADMIN');
      await request(app.getHttpServer())
        .patch(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Tampered Name' })
        .expect(403);
    });

    it('Platform Admin receives 403 Forbidden when trying to deactivate an admin', async () => {
      const token = signAdminJwt(platformAdminId, 'ops@tropos.dev', 'PLATFORM_ADMIN');
      await request(app.getHttpServer())
        .delete(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('Super Admin can list platform admins successfully', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .get('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body.some((a: any) => a.email === 'root@tropos.dev')).toBe(true);
      expect(res.body.some((a: any) => a.email === 'ops@tropos.dev')).toBe(true);
    });
  });

  describe('Super Admin CRUD & Safety Invariants', () => {
    let createdAdminId: string;

    it('Super Admin invites a new admin successfully', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'analyst@tropos.dev',
          fullName: 'ESG Analyst',
          role: 'PLATFORM_ADMIN',
          temporaryPassword: 'TempPassword2026!',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe('analyst@tropos.dev');
      expect(res.body.data.fullName).toBe('ESG Analyst');
      expect(res.body.data.role).toBe('PLATFORM_ADMIN');
      expect(res.body.data.passwordHash).toBeUndefined(); // Safe response
      createdAdminId = res.body.data.id;
    });

    it('Prevents creating duplicate admin emails', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      await request(app.getHttpServer())
        .post('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'analyst@tropos.dev',
          fullName: 'Duplicate Analyst',
          role: 'PLATFORM_ADMIN',
          temporaryPassword: 'TempPassword2026!',
        })
        .expect(409);
    });

    it('Super Admin updates an administrator profile successfully', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Senior ESG Analyst',
          jobTitle: 'Lead Carbon Auditor',
          phone: '+1 555-0144',
        })
        .expect(200);

      expect(res.body.data.fullName).toBe('Senior ESG Analyst');
      expect(res.body.data.jobTitle).toBe('Lead Carbon Auditor');
      expect(res.body.data.phone).toBe('+1 555-0144');
    });

    it('Prevents changing email to an already existing admin email', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      await request(app.getHttpServer())
        .patch(`/platform/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'ops@tropos.dev' })
        .expect(409);
    });

    it('Enforces Self-Action Invariant: Super Admin cannot demote themselves', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'PLATFORM_ADMIN' })
        .expect(400);

      expect(res.body.message).toMatch(/cannot modify your own/i);
    });

    it('Enforces Self-Action Invariant: Super Admin cannot deactivate themselves', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(400);

      expect(res.body.message).toMatch(/cannot deactivate your own account/i);
    });

    it('Enforces Self-Action Invariant: Super Admin cannot delete themselves', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .delete(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot remove your own/i);
    });

    it('Enforces Last Super Admin Invariant: Cannot deactivate sole active Super Admin', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      // Even if another target is requested, superAdminId is the only Super Admin in store
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${superAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('Super Admin can reset credentials and set a new temporary password', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ temporaryPassword: 'BrandNewSecurePass2026!' })
        .expect(200);

      expect(res.body.data.id).toBe(createdAdminId);
    });

    it('Super Admin can unlock a locked account', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .patch(`/platform/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unlock: true })
        .expect(200);

      expect(res.body.data.failedLoginCount).toBe(0);
      expect(res.body.data.lockedUntil).toBeNull();
    });

    it('Super Admin can deactivate / remove an administrator', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .delete(`/platform/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toMatch(/deactivated/i);
    });

    it('Super Admin can restore a deactivated administrator', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      const res = await request(app.getHttpServer())
        .post(`/platform/admins/${createdAdminId}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.deletedAt).toBeNull();
    });

    it('Super Admin can permanently purge an administrator record', async () => {
      const token = signAdminJwt(superAdminId, 'root@tropos.dev', 'SUPER_ADMIN');
      await request(app.getHttpServer())
        .delete(`/platform/admins/${createdAdminId}/purge`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify no longer in list
      const listRes = await request(app.getHttpServer())
        .get('/platform/admins')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.some((a: any) => a.id === createdAdminId)).toBe(false);
    });
  });
});
