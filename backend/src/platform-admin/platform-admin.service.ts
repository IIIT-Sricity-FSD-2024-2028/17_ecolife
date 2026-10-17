import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import {
  AdminCreateDepartmentDto,
  AdminCreateOrgUserDto,
  AdminUpdateDepartmentDto,
  AdminUpdateOrgUserDto,
  CreateOrganizationDto,
  InvitePlatformAdminDto,
  UpdatePlatformAdminDto,
  UpdateOrganizationDto,
  UpdateOrgStatusDto,
  UpdatePlatformSettingsDto,
} from './dto/platform-admin.dto';
import { Department, Organization, OrgRole, OrgUser, PlatformRole, resolveSettings } from '../database/types';
import { assertWithinPlan, isUnlimited } from '../billing/plan-limits';

const SALT_ROUNDS = 10;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'org'
  );
}

@Injectable()
export class PlatformAdminService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  // ---------------------------------------------------------------------
  // Organization lifecycle & CRUD
  // ---------------------------------------------------------------------
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  purgeExpiredOrganizations() {
    const now = Date.now();
    const expired = this.db.store.organizations.filter(
      (o) => o.status === 'DELETED' && o.scheduledPurgeAt && new Date(o.scheduledPurgeAt).getTime() <= now,
    );
    for (const org of expired) {
      this.purgeOrganizationPermanent(org.id);
    }
  }

  private purgeOrganizationPermanent(id: string) {
    const orgIndex = this.db.store.organizations.findIndex((o) => o.id === id);
    if (orgIndex === -1) return;
    const org = this.db.store.organizations[orgIndex];

    const deptIds = new Set(this.db.store.departments.filter((d) => d.organizationId === id).map((d) => d.id));
    this.db.store.locations = this.db.store.locations.filter((l) => !deptIds.has(l.departmentId));
    this.db.store.departments = this.db.store.departments.filter((d) => d.organizationId !== id);
    this.db.store.orgUsers = this.db.store.orgUsers.filter((u) => u.organizationId !== id);
    const recordIds = new Set(this.db.store.resourceRecords.filter((r) => r.organizationId === id).map((r) => r.id));
    this.db.store.calculationResults = this.db.store.calculationResults.filter((c) => !recordIds.has(c.resourceRecordId));
    this.db.store.amendments = this.db.store.amendments.filter((a) => !recordIds.has(a.resourceRecordId));
    this.db.store.resourceRecords = this.db.store.resourceRecords.filter((r) => r.organizationId !== id);
    this.db.store.reports = this.db.store.reports.filter((r) => r.organizationId !== id);
    this.db.store.alerts = this.db.store.alerts.filter((a) => a.organizationId !== id);
    this.db.store.targets = this.db.store.targets.filter((t) => t.organizationId !== id);
    this.db.store.emissionFactorVersions = this.db.store.emissionFactorVersions.filter((f) => f.organizationId !== id);

    const subIds = new Set(this.db.store.subscriptions.filter((s) => s.organizationId === id).map((s) => s.id));
    this.db.store.invoices = this.db.store.invoices.filter((i) => !subIds.has(i.subscriptionId));
    this.db.store.subscriptions = this.db.store.subscriptions.filter((s) => s.organizationId !== id);

    this.db.store.organizations.splice(orgIndex, 1);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: 'system',
      organizationId: id,
      action: 'organization.purged_automatically',
      entityType: 'organization',
      entityId: id,
      metadata: { name: org.name },
    });
  }

  listOrganizations() {
    this.purgeExpiredOrganizations();
    return [...this.db.store.organizations].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  getOrganization(id: string) {
    this.purgeExpiredOrganizations();
    const org = this.db.store.organizations.find((o) => o.id === id);
    if (!org) throw new NotFoundException('Organization not found.');
    return org;
  }

  async createOrganization(admin: AuthenticatedPlatformAdmin, dto: CreateOrganizationDto) {
    const email = dto.ownerEmail.trim().toLowerCase();
    if (this.db.store.orgUsers.some((u) => u.email.toLowerCase() === email && !u.deletedAt)) {
      throw new ConflictException({
        message: 'A user with this email already exists.',
        errors: [{ field: 'ownerEmail', message: 'Email is already in use.' }],
      });
    }

    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let attempt = 1;
    while (this.db.store.organizations.some((o) => o.slug === slug)) {
      slug = `${baseSlug}-${++attempt}`;
    }

    const passwordHash = await bcrypt.hash(dto.password || 'Welcome123!', SALT_ROUNDS);
    const now = this.db.now();

    const organization: Organization = {
      id: this.db.id(),
      name: dto.name,
      slug,
      status: 'ACTIVE',
      maintenanceMode: false,
      sessionTimeoutOverrideMin: null,
      carbonPricePerTon: dto.carbonPricePerTon ?? 0,
      currency: dto.currency?.trim() || 'USD',
      baselineYear: dto.baselineYear ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.organizations.push(organization);

    const owner: OrgUser = {
      id: this.db.id(),
      organizationId: organization.id,
      email,
      passwordHash,
      emailVerifiedAt: now,
      fullName: dto.ownerName,
      role: 'ORG_ADMIN',
      isOwner: true,
      isActive: true,
      departmentId: null,
      invitedById: admin.sub,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };
    this.db.store.orgUsers.push(owner);

    let chosenPlan = dto.planId ? this.db.store.plans.find((p) => p.id === dto.planId) : null;
    if (!chosenPlan) {
      chosenPlan = [...this.db.store.plans]
        .filter((p) => p.isActive)
        .sort((a, b) => a.priceMonthly - b.priceMonthly)[0];
    }

    if (chosenPlan) {
      this.db.store.subscriptions.push({
        id: this.db.id(),
        organizationId: organization.id,
        planId: chosenPlan.id,
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        startDate: now,
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelledAt: null,
        updatedAt: now,
      });
    }

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: organization.id,
      action: 'organization.created_by_admin',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { name: organization.name, ownerEmail: email, planId: chosenPlan?.id },
    });

    const { passwordHash: _, ...safeOwner } = owner;
    void _;
    return { organization, owner: safeOwner };
  }

  updateOrganization(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdateOrganizationDto) {
    const org = this.getOrganization(id);
    if (dto.name !== undefined) org.name = dto.name;
    if (dto.baselineYear !== undefined) org.baselineYear = dto.baselineYear;
    if (dto.currency !== undefined) org.currency = dto.currency;
    if (dto.carbonPricePerTon !== undefined) org.carbonPricePerTon = dto.carbonPricePerTon;
    if (dto.sessionTimeoutOverrideMin !== undefined) org.sessionTimeoutOverrideMin = dto.sessionTimeoutOverrideMin;
    if (dto.maintenanceMode !== undefined) org.maintenanceMode = dto.maintenanceMode;

    if (dto.planId) {
      const plan = this.db.store.plans.find((p) => p.id === dto.planId);
      if (!plan) throw new NotFoundException('Subscription plan not found.');

      // Strict plan limit dependency checks before plan switch/downgrade
      const activeUsers = this.db.store.orgUsers.filter((u) => u.organizationId === id && u.isActive && !u.deletedAt).length;
      const activeDepts = this.db.store.departments.filter((d) => d.organizationId === id && !d.deletedAt).length;

      if (!isUnlimited(plan.maxUsers) && activeUsers > plan.maxUsers) {
        throw new BadRequestException(
          `Cannot switch to plan "${plan.name}": Organization currently has ${activeUsers} active user(s), which exceeds this plan's limit of ${plan.maxUsers}. Please deactivate excess users before switching.`,
        );
      }
      if (!isUnlimited(plan.maxDepartments) && activeDepts > plan.maxDepartments) {
        throw new BadRequestException(
          `Cannot switch to plan "${plan.name}": Organization currently has ${activeDepts} department(s), which exceeds this plan's limit of ${plan.maxDepartments}. Please remove excess departments before switching.`,
        );
      }

      const sub = this.db.store.subscriptions.find((s) => s.organizationId === id);
      if (sub) {
        sub.planId = plan.id;
        sub.updatedAt = this.db.now();
      } else {
        this.db.store.subscriptions.push({
          id: this.db.id(),
          organizationId: id,
          planId: plan.id,
          status: 'ACTIVE',
          cycle: 'MONTHLY',
          startDate: this.db.now(),
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelledAt: null,
          updatedAt: this.db.now(),
        });
      }
    }

    org.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: id,
      action: 'organization.updated_by_admin',
      entityType: 'organization',
      entityId: id,
      metadata: dto as Record<string, unknown>,
    });

    return org;
  }

  /**
   * Soft-deletes the organization with a 30-day recovery grace period.
   * Access is immediately blocked; data is retained for 30 days and automatically purged thereafter.
   */
  deleteOrganization(admin: AuthenticatedPlatformAdmin, id: string) {
    this.purgeExpiredOrganizations();
    const org = this.getOrganization(id);
    if (org.status === 'DELETED') {
      throw new BadRequestException('Organization is already scheduled for deletion.');
    }

    const now = this.db.now();
    const scheduledPurgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    org.status = 'DELETED';
    org.deletedAt = now;
    org.scheduledPurgeAt = scheduledPurgeAt;
    org.statusReason = 'Scheduled for deletion (30-day recovery grace period).';
    org.statusChangedAt = now;
    org.updatedAt = now;

    // Immediately deactivate users so nobody in this org can log in
    this.db.store.orgUsers.forEach((u) => {
      if (u.organizationId === id) {
        u.isActive = false;
        u.deletedAt = now;
        u.updatedAt = now;
      }
    });

    // Soft delete departments
    this.db.store.departments.forEach((d) => {
      if (d.organizationId === id) {
        d.deletedAt = now;
        d.updatedAt = now;
      }
    });

    // Cancel active subscriptions
    this.db.store.subscriptions.forEach((s) => {
      if (s.organizationId === id && s.status === 'ACTIVE') {
        s.status = 'CANCELLED';
        s.cancelledAt = now;
        s.updatedAt = now;
      }
    });

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: id,
      action: 'organization.soft_deleted',
      entityType: 'organization',
      entityId: id,
      metadata: { name: org.name, scheduledPurgeAt, retentionDays: 30 },
    });

    return {
      id: org.id,
      name: org.name,
      status: org.status,
      deletedAt: org.deletedAt,
      scheduledPurgeAt: org.scheduledPurgeAt,
      retentionDays: 30,
    };
  }

  /**
   * Restores an organization that was soft-deleted, reviving its departments, users, and subscription.
   */
  restoreOrganization(admin: AuthenticatedPlatformAdmin, id: string) {
    const org = this.getOrganization(id);
    if (org.status !== 'DELETED') {
      throw new BadRequestException('Organization is not marked for deletion.');
    }

    const now = this.db.now();
    org.status = 'ACTIVE';
    org.deletedAt = null;
    org.scheduledPurgeAt = null;
    org.statusReason = null;
    org.statusChangedAt = now;
    org.updatedAt = now;

    // Restore departments
    this.db.store.departments.forEach((d) => {
      if (d.organizationId === id && d.deletedAt) {
        d.deletedAt = null;
        d.updatedAt = now;
      }
    });

    // Restore users
    this.db.store.orgUsers.forEach((u) => {
      if (u.organizationId === id && u.deletedAt) {
        u.deletedAt = null;
        u.isActive = true;
        u.updatedAt = now;
      }
    });

    // Restore subscription
    this.db.store.subscriptions.forEach((s) => {
      if (s.organizationId === id && s.status === 'CANCELLED') {
        s.status = 'ACTIVE';
        s.cancelledAt = null;
        s.updatedAt = now;
      }
    });

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: id,
      action: 'organization.restored',
      entityType: 'organization',
      entityId: id,
      metadata: { name: org.name },
    });

    return org;
  }

  /**
   * Super Admin permanent hard delete (skips the grace period for immediate compliance/purge requests).
   */
  purgeOrganization(admin: AuthenticatedPlatformAdmin, id: string) {
    const orgIndex = this.db.store.organizations.findIndex((o) => o.id === id);
    if (orgIndex === -1) throw new NotFoundException('Organization not found.');
    const org = this.db.store.organizations[orgIndex];

    this.purgeOrganizationPermanent(id);

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: id,
      action: 'organization.purged_permanently',
      entityType: 'organization',
      entityId: id,
      metadata: { name: org.name },
    });

    return { id, purged: true };
  }

  updateOrgStatus(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdateOrgStatusDto) {
    const org = this.getOrganization(id);
    const reason = dto.reason?.trim() || null;
    if (dto.status === 'SUSPENDED' && !reason) {
      const message = 'Give a reason for suspending this organization.';
      throw new BadRequestException({ message, errors: [{ field: 'reason', message }] });
    }
    org.status = dto.status as any;
    org.statusReason = dto.status === 'SUSPENDED' ? reason : null;
    org.statusChangedAt = this.db.now();
    org.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: id,
      action: 'organization.status_changed',
      entityType: 'organization',
      entityId: id,
      metadata: { newStatus: dto.status, ...(reason ? { reason } : {}) },
    });

    return org;
  }

  // ---------------------------------------------------------------------
  // Organization Departments (Admin Scope)
  // ---------------------------------------------------------------------
  listOrgDepartments(orgId: string) {
    this.getOrganization(orgId);
    return this.db.store.departments
      .filter((d) => d.organizationId === orgId && !d.deletedAt)
      .map((d) => ({
        ...d,
        memberCount: this.db.store.orgUsers.filter((u) => u.departmentId === d.id && u.isActive && !u.deletedAt).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  createOrgDepartment(admin: AuthenticatedPlatformAdmin, orgId: string, dto: AdminCreateDepartmentDto) {
    this.getOrganization(orgId);
    // Strictly enforce subscription plan department limit
    assertWithinPlan(this.db, orgId, 'departments');

    const now = this.db.now();
    const dept: Department = {
      id: this.db.id(),
      organizationId: orgId,
      name: dto.name,
      description: dto.description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.departments.push(dept);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'department.created_by_admin',
      entityType: 'department',
      entityId: dept.id,
      metadata: { name: dept.name },
    });

    return { ...dept, memberCount: 0 };
  }

  updateOrgDepartment(admin: AuthenticatedPlatformAdmin, orgId: string, deptId: string, dto: AdminUpdateDepartmentDto) {
    this.getOrganization(orgId);
    const dept = this.db.store.departments.find((d) => d.id === deptId && d.organizationId === orgId && !d.deletedAt);
    if (!dept) throw new NotFoundException('Department not found in this organization.');

    if (dto.name !== undefined) dept.name = dto.name;
    if (dto.description !== undefined) dept.description = dto.description?.trim() || null;
    dept.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'department.updated_by_admin',
      entityType: 'department',
      entityId: dept.id,
      metadata: { name: dept.name },
    });

    return {
      ...dept,
      memberCount: this.db.store.orgUsers.filter((u) => u.departmentId === dept.id && u.isActive && !u.deletedAt).length,
    };
  }

  deleteOrgDepartment(admin: AuthenticatedPlatformAdmin, orgId: string, deptId: string) {
    this.getOrganization(orgId);
    const dept = this.db.store.departments.find((d) => d.id === deptId && d.organizationId === orgId && !d.deletedAt);
    if (!dept) throw new NotFoundException('Department not found in this organization.');

    const now = this.db.now();
    dept.deletedAt = now;
    dept.updatedAt = now;

    // Unassign users from this soft-deleted department
    this.db.store.orgUsers.forEach((u) => {
      if (u.departmentId === deptId) {
        u.departmentId = null;
        u.updatedAt = now;
      }
    });

    // Unassign locations from this department
    this.db.store.locations.forEach((l) => {
      if (l.departmentId === deptId) {
        l.departmentId = '';
      }
    });

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'department.soft_deleted_by_admin',
      entityType: 'department',
      entityId: deptId,
      metadata: { name: dept.name },
    });

    return { id: deptId, deleted: true };
  }

  // ---------------------------------------------------------------------
  // Organization Users (Admin Scope)
  // ---------------------------------------------------------------------
  listOrgUsers(orgId: string) {
    this.getOrganization(orgId);
    return this.db.store.orgUsers
      .filter((u) => u.organizationId === orgId && !u.deletedAt)
      .map((u) => {
        const dept = u.departmentId ? this.db.store.departments.find((d) => d.id === u.departmentId && !d.deletedAt) : null;
        const { passwordHash: _, ...safe } = u;
        void _;
        return {
          ...safe,
          departmentName: dept?.name ?? null,
        };
      })
      .sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0) || a.fullName.localeCompare(b.fullName));
  }

  async createOrgUser(admin: AuthenticatedPlatformAdmin, orgId: string, dto: AdminCreateOrgUserDto) {
    this.getOrganization(orgId);
    // Strictly enforce subscription plan user limit
    assertWithinPlan(this.db, orgId, 'users');

    const email = dto.email.trim().toLowerCase();
    if (this.db.store.orgUsers.some((u) => u.email.toLowerCase() === email && !u.deletedAt)) {
      throw new ConflictException({
        message: 'A user with this email already exists.',
        errors: [{ field: 'email', message: 'Email already exists.' }],
      });
    }

    if (dto.departmentId) {
      const deptExists = this.db.store.departments.some(
        (d) => d.id === dto.departmentId && d.organizationId === orgId && !d.deletedAt,
      );
      if (!deptExists) throw new BadRequestException('Selected department does not exist or has been deleted.');
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword || 'Welcome123!', SALT_ROUNDS);
    const now = this.db.now();

    const user: OrgUser = {
      id: this.db.id(),
      organizationId: orgId,
      email,
      passwordHash,
      emailVerifiedAt: now,
      fullName: dto.fullName,
      role: dto.role as OrgRole,
      isOwner: false,
      isActive: true,
      departmentId: dto.departmentId ?? null,
      invitedById: admin.sub,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };
    this.db.store.orgUsers.push(user);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'org_user.created_by_admin',
      entityType: 'org_user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    const dept = user.departmentId ? this.db.store.departments.find((d) => d.id === user.departmentId && !d.deletedAt) : null;
    const { passwordHash: _, ...safe } = user;
    void _;
    return { ...safe, departmentName: dept?.name ?? null };
  }

  updateOrgUser(admin: AuthenticatedPlatformAdmin, orgId: string, userId: string, dto: AdminUpdateOrgUserDto) {
    this.getOrganization(orgId);
    const user = this.db.store.orgUsers.find((u) => u.id === userId && u.organizationId === orgId && !u.deletedAt);
    if (!user) throw new NotFoundException('User not found in this organization.');

    // If activating a deactivated user, ensure plan user limits are respected
    if (dto.isActive === true && !user.isActive) {
      assertWithinPlan(this.db, orgId, 'users');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.role !== undefined) user.role = dto.role as OrgRole;
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        const deptExists = this.db.store.departments.some(
          (d) => d.id === dto.departmentId && d.organizationId === orgId && !d.deletedAt,
        );
        if (!deptExists) throw new BadRequestException('Department does not exist or has been deleted.');
      }
      user.departmentId = dto.departmentId;
    }
    if (dto.isActive !== undefined) {
      if (!dto.isActive && user.isOwner) {
        const activeOwners = this.db.store.orgUsers.filter(
          (u) => u.organizationId === orgId && u.isOwner && u.isActive && !u.deletedAt,
        );
        if (activeOwners.length <= 1) {
          throw new BadRequestException('Cannot deactivate the sole owner of an organization.');
        }
      }
      user.isActive = dto.isActive;
    }
    user.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'org_user.updated_by_admin',
      entityType: 'org_user',
      entityId: user.id,
      metadata: dto as Record<string, unknown>,
    });

    const dept = user.departmentId ? this.db.store.departments.find((d) => d.id === user.departmentId && !d.deletedAt) : null;
    const { passwordHash: _, ...safe } = user;
    void _;
    return { ...safe, departmentName: dept?.name ?? null };
  }

  deactivateOrgUser(admin: AuthenticatedPlatformAdmin, orgId: string, userId: string) {
    this.getOrganization(orgId);
    const user = this.db.store.orgUsers.find((u) => u.id === userId && u.organizationId === orgId && !u.deletedAt);
    if (!user) throw new NotFoundException('User not found in this organization.');

    if (user.isOwner) {
      const activeOwners = this.db.store.orgUsers.filter(
        (u) => u.organizationId === orgId && u.isOwner && u.isActive && !u.deletedAt,
      );
      if (activeOwners.length <= 1) {
        throw new BadRequestException('Cannot deactivate the sole owner of an organization.');
      }
    }

    const now = this.db.now();
    user.isActive = false;
    user.deletedAt = now;
    user.updatedAt = now;
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      organizationId: orgId,
      action: 'org_user.soft_deleted_by_admin',
      entityType: 'org_user',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return { id: userId, deactivated: true };
  }

  // ---------------------------------------------------------------------
  // Admin team (Super Admin only)
  // ---------------------------------------------------------------------
  getAdmin(id: string) {
    const admin = this.db.store.platformAdmins.find((a) => a.id === id);
    if (!admin) throw new NotFoundException('Admin not found.');
    const { passwordHash: _, ...safe } = admin;
    void _;
    return safe;
  }

  async inviteAdmin(actor: AuthenticatedPlatformAdmin, dto: InvitePlatformAdminDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    if (this.db.store.platformAdmins.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      throw new ConflictException('An admin with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, SALT_ROUNDS);
    const now = this.db.now();

    const admin = {
      id: this.db.id(),
      email: normalizedEmail,
      passwordHash,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() || null,
      jobTitle: dto.jobTitle?.trim() || null,
      role: dto.role as PlatformRole,
      isActive: true,
      invitedById: actor.sub,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
      deletedAt: null,
    };
    this.db.store.platformAdmins.push(admin);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.invited',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { email: admin.email, role: admin.role, fullName: admin.fullName },
    });

    const { passwordHash: removedPasswordHash, ...safe } = admin;
    void removedPasswordHash;
    return safe;
  }

  listAdmins() {
    return this.db.store.platformAdmins.map((admin) => {
      const { passwordHash, ...safe } = admin;
      void passwordHash;
      return safe;
    });
  }

  async updateAdmin(actor: AuthenticatedPlatformAdmin, targetId: string, dto: UpdatePlatformAdminDto) {
    const target = this.db.store.platformAdmins.find((a) => a.id === targetId);
    if (!target) throw new NotFoundException('Admin not found.');

    // 1. Email uniqueness check
    if (dto.email && dto.email.trim().toLowerCase() !== target.email.toLowerCase()) {
      const normalized = dto.email.trim().toLowerCase();
      const conflict = this.db.store.platformAdmins.find(
        (a) => a.id !== targetId && a.email.toLowerCase() === normalized,
      );
      if (conflict) {
        throw new ConflictException('An admin with this email already exists.');
      }
    }

    // 2. Invariant: Self-Action Protection
    if (actor.sub === targetId) {
      if (dto.role && dto.role !== target.role) {
        throw new BadRequestException('You cannot modify your own administrative role.');
      }
      if (dto.isActive === false) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }
    }

    // 3. Invariant: Last Super Admin Protection
    if (target.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = this.db.store.platformAdmins.filter(
        (a) => a.role === 'SUPER_ADMIN' && a.isActive && !a.deletedAt,
      );
      const isDemoting = dto.role && dto.role !== 'SUPER_ADMIN';
      const isDeactivating = dto.isActive === false;
      if ((isDemoting || isDeactivating) && activeSuperAdmins.length <= 1) {
        throw new BadRequestException(
          'Cannot demote or deactivate the last remaining active Super Admin — this would lock the platform out of its own administration.',
        );
      }
    }

    const now = this.db.now();
    const changes: Record<string, unknown> = {};

    if (dto.fullName !== undefined) {
      target.fullName = dto.fullName.trim();
      changes.fullName = target.fullName;
    }
    if (dto.email !== undefined) {
      target.email = dto.email.trim().toLowerCase();
      changes.email = target.email;
    }
    if (dto.role !== undefined) {
      target.role = dto.role as PlatformRole;
      changes.role = target.role;
    }
    if (dto.isActive !== undefined) {
      target.isActive = dto.isActive;
      changes.isActive = target.isActive;
    }
    if (dto.phone !== undefined) {
      target.phone = dto.phone?.trim() || null;
      changes.phone = target.phone;
    }
    if (dto.jobTitle !== undefined) {
      target.jobTitle = dto.jobTitle?.trim() || null;
      changes.jobTitle = target.jobTitle;
    }
    if (dto.temporaryPassword) {
      target.passwordHash = await bcrypt.hash(dto.temporaryPassword, SALT_ROUNDS);
      target.passwordChangedAt = now;
      changes.passwordReset = true;
    }
    if (dto.unlock) {
      target.failedLoginCount = 0;
      target.lockedUntil = null;
      changes.unlocked = true;
    }

    target.updatedAt = now;
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.updated',
      entityType: 'platform_admin',
      entityId: targetId,
      metadata: changes,
    });

    const { passwordHash: _, ...safe } = target;
    void _;
    return safe;
  }

  /** Never removes yourself, never removes the last remaining Super Admin —
   * that role exists specifically to prevent this kind of lockout. */
  removeAdmin(actor: AuthenticatedPlatformAdmin, targetId: string) {
    if (actor.sub === targetId) {
      throw new BadRequestException('You cannot remove your own admin account.');
    }

    const target = this.db.store.platformAdmins.find((a) => a.id === targetId);
    if (!target) throw new NotFoundException('Admin not found.');

    if (target.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = this.db.store.platformAdmins.filter(
        (a) => a.role === 'SUPER_ADMIN' && a.isActive && !a.deletedAt,
      ).length;
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException(
          'Cannot remove the last remaining Super Admin — this would lock the platform out of its own administration.',
        );
      }
    }

    const now = this.db.now();
    target.isActive = false;
    target.deletedAt = now;
    target.updatedAt = now;
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.deactivated',
      entityType: 'platform_admin',
      entityId: targetId,
      metadata: { email: target.email, role: target.role },
    });

    return { id: targetId, deactivated: true };
  }

  restoreAdmin(actor: AuthenticatedPlatformAdmin, targetId: string) {
    const target = this.db.store.platformAdmins.find((a) => a.id === targetId);
    if (!target) throw new NotFoundException('Admin not found.');

    const now = this.db.now();
    target.deletedAt = null;
    target.isActive = true;
    target.updatedAt = now;
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.restored',
      entityType: 'platform_admin',
      entityId: targetId,
      metadata: { email: target.email, role: target.role },
    });

    const { passwordHash: _, ...safe } = target;
    void _;
    return safe;
  }

  purgeAdmin(actor: AuthenticatedPlatformAdmin, targetId: string) {
    if (actor.sub === targetId) {
      throw new BadRequestException('You cannot permanently purge your own admin account.');
    }

    const target = this.db.store.platformAdmins.find((a) => a.id === targetId);
    if (!target) throw new NotFoundException('Admin not found.');

    if (target.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = this.db.store.platformAdmins.filter(
        (a) => a.role === 'SUPER_ADMIN' && a.isActive && !a.deletedAt,
      ).length;
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Cannot purge the last remaining Super Admin.');
      }
    }

    this.db.store.platformAdmins = this.db.store.platformAdmins.filter((a) => a.id !== targetId);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.purged',
      entityType: 'platform_admin',
      entityId: targetId,
      metadata: { email: target.email, role: target.role },
    });

    return { id: targetId, purged: true };
  }

  // ---------------------------------------------------------------------
  // Global settings
  // ---------------------------------------------------------------------
  getSettings() {
    return resolveSettings(this.db.store.platformSettings);
  }

  updateSettings(admin: AuthenticatedPlatformAdmin, dto: UpdatePlatformSettingsDto) {
    const settings = this.db.store.platformSettings;

    // Security and sign-up policy is Super Admin only. Compared against the current values so a
    // Platform Admin saving the full form (e.g. to toggle maintenance) isn't blocked by unchanged fields.
    if (admin.role !== 'SUPER_ADMIN') {
      const current = resolveSettings(settings);
      const policyFields = ['defaultSessionTimeoutMin', 'maxFailedLogins', 'lockoutMinutes', 'allowRegistration', 'requireWorkEmail'] as const;
      const changed = policyFields.filter((f) => dto[f] !== undefined && dto[f] !== current[f]);
      if (changed.length > 0) {
        throw new ForbiddenException('Only a Super Admin can change security and sign-up settings.');
      }
    }

    if (dto.maintenanceMode !== undefined) settings.maintenanceMode = dto.maintenanceMode;
    if (dto.maintenanceMessage !== undefined) settings.maintenanceMessage = dto.maintenanceMessage;
    if (dto.defaultSessionTimeoutMin !== undefined) settings.defaultSessionTimeoutMin = dto.defaultSessionTimeoutMin;
    if (dto.maxFailedLogins !== undefined) settings.maxFailedLogins = dto.maxFailedLogins;
    if (dto.lockoutMinutes !== undefined) settings.lockoutMinutes = dto.lockoutMinutes;
    if (dto.allowRegistration !== undefined) settings.allowRegistration = dto.allowRegistration;
    if (dto.requireWorkEmail !== undefined) settings.requireWorkEmail = dto.requireWorkEmail;
    settings.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'platform_settings.updated',
      entityType: 'platform_settings',
      entityId: 'singleton',
      metadata: dto as unknown as Record<string, unknown>,
    });

    return resolveSettings(settings);
  }
}
