import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { InvitePlatformAdminDto, UpdateOrgStatusDto, UpdatePlatformSettingsDto } from './dto/platform-admin.dto';
import { PlatformRole, resolveSettings } from '../database/types';

const SALT_ROUNDS = 10;

@Injectable()
export class PlatformAdminService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  // ---------------------------------------------------------------------
  // Organization lifecycle
  // ---------------------------------------------------------------------
  listOrganizations() {
    return [...this.db.store.organizations].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  getOrganization(id: string) {
    const org = this.db.store.organizations.find((o) => o.id === id);
    if (!org) throw new NotFoundException('Organization not found.');
    return org;
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
  // Admin team (Super Admin only)
  // ---------------------------------------------------------------------
  async inviteAdmin(actor: AuthenticatedPlatformAdmin, dto: InvitePlatformAdminDto) {
    if (this.db.store.platformAdmins.some((a) => a.email === dto.email)) {
      throw new ConflictException('An admin with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, SALT_ROUNDS);
    const now = this.db.now();

    const admin = {
      id: this.db.id(),
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role as PlatformRole,
      isActive: true,
      invitedById: actor.sub,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };
    this.db.store.platformAdmins.push(admin);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.invited',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { email: admin.email, role: admin.role },
    });

    const { passwordHash: _, ...safe } = admin;
    return safe;
  }

  listAdmins() {
    return this.db.store.platformAdmins.map(({ passwordHash, ...safe }) => safe);
  }

  /** Never removes yourself, never removes the last remaining Super Admin —
   * that role exists specifically to prevent this kind of lockout. */
  removeAdmin(actor: AuthenticatedPlatformAdmin, targetId: string) {
    if (actor.sub === targetId) {
      throw new ForbiddenException('You cannot remove your own admin account.');
    }

    const target = this.db.store.platformAdmins.find((a) => a.id === targetId);
    if (!target) throw new NotFoundException('Admin not found.');

    if (target.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = this.db.store.platformAdmins.filter(
        (a) => a.role === 'SUPER_ADMIN' && a.isActive,
      ).length;
      if (activeSuperAdmins <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last remaining Super Admin — this would lock the platform out of its own administration.',
        );
      }
    }

    target.isActive = false;
    target.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: actor.sub,
      action: 'platform_admin.deactivated',
      entityType: 'platform_admin',
      entityId: targetId,
    });

    return { id: targetId, deactivated: true };
  }

  // ---------------------------------------------------------------------
  // Global settings
  // ---------------------------------------------------------------------
  getSettings() {
    return resolveSettings(this.db.store.platformSettings);
  }

  updateSettings(admin: AuthenticatedPlatformAdmin, dto: UpdatePlatformSettingsDto) {
    const settings = this.db.store.platformSettings;
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
