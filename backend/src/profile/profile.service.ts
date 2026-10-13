import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser, AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

/**
 * Self-service profile for the signed-in person (org user or platform
 * admin). Everything here is scoped to the caller's own id from the JWT —
 * there is deliberately no way to name a different user.
 */
@Injectable()
export class ProfileService {
  private readonly saltRounds: number;

  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    config: ConfigService,
  ) {
    this.saltRounds = Number(config.get('BCRYPT_SALT_ROUNDS') ?? 10);
  }

  // ---- Org user -----------------------------------------------------------

  getOrgProfile(actor: AuthenticatedOrgUser) {
    const user = this.findOrgUser(actor);
    const org = this.db.store.organizations.find((o) => o.id === user.organizationId);
    const dept = user.departmentId ? this.db.store.departments.find((d) => d.id === user.departmentId) : null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      jobTitle: user.jobTitle ?? null,
      passwordChangedAt: user.passwordChangedAt ?? null,
      role: user.role,
      isOwner: user.isOwner,
      organizationName: org?.name ?? null,
      departmentId: user.departmentId ?? null,
      departmentName: dept?.name ?? null,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }

  updateOrgProfile(actor: AuthenticatedOrgUser, dto: UpdateProfileDto) {
    const user = this.findOrgUser(actor);
    this.applyProfile(user, dto);
    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.id,
      action: 'profile.updated',
      entityType: 'OrgUser',
      entityId: user.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.getOrgProfile(actor);
  }

  async changeOrgPassword(actor: AuthenticatedOrgUser, dto: ChangePasswordDto) {
    const user = this.findOrgUser(actor);
    await this.applyPasswordChange(user, dto);
    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.id,
      action: 'profile.password_changed',
      entityType: 'OrgUser',
      entityId: user.id,
    });
  }

  // ---- Platform admin -----------------------------------------------------

  getAdminProfile(actor: AuthenticatedPlatformAdmin) {
    const admin = this.findAdmin(actor);
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone ?? null,
      jobTitle: admin.jobTitle ?? null,
      passwordChangedAt: admin.passwordChangedAt ?? null,
      role: admin.role,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
    };
  }

  updateAdminProfile(actor: AuthenticatedPlatformAdmin, dto: UpdateProfileDto) {
    const admin = this.findAdmin(actor);
    this.applyProfile(admin, dto);
    this.auditLog.log({
      platformAdminId: admin.id,
      action: 'profile.updated',
      entityType: 'PlatformAdmin',
      entityId: admin.id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.getAdminProfile(actor);
  }

  async changeAdminPassword(actor: AuthenticatedPlatformAdmin, dto: ChangePasswordDto) {
    const admin = this.findAdmin(actor);
    await this.applyPasswordChange(admin, dto);
    this.auditLog.log({
      platformAdminId: admin.id,
      action: 'profile.password_changed',
      entityType: 'PlatformAdmin',
      entityId: admin.id,
    });
  }

  // ---- Helpers ------------------------------------------------------------

  private findOrgUser(actor: AuthenticatedOrgUser) {
    const user = this.db.store.orgUsers.find((u) => u.id === actor.sub);
    if (!user) throw new NotFoundException('Account not found.');
    return user;
  }

  private findAdmin(actor: AuthenticatedPlatformAdmin) {
    const admin = this.db.store.platformAdmins.find((a) => a.id === actor.sub);
    if (!admin) throw new NotFoundException('Account not found.');
    return admin;
  }

  private applyProfile(
    target: { fullName: string; phone?: string | null; jobTitle?: string | null; updatedAt: string },
    dto: UpdateProfileDto,
  ) {
    if (dto.fullName !== undefined) target.fullName = dto.fullName;
    if (dto.phone !== undefined) target.phone = dto.phone === '' ? null : dto.phone;
    if (dto.jobTitle !== undefined) target.jobTitle = dto.jobTitle === '' ? null : dto.jobTitle;
    target.updatedAt = this.db.now();
    this.db.persist();
  }

  private async applyPasswordChange(
    target: { passwordHash: string; passwordChangedAt?: string | null; updatedAt: string },
    dto: ChangePasswordDto,
  ) {
    const matches = await bcrypt.compare(dto.currentPassword, target.passwordHash);
    if (!matches) throw new BadRequestException('Your current password is incorrect.');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Your new password must be different from your current password.');
    }
    target.passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);
    target.passwordChangedAt = this.db.now();
    target.updatedAt = this.db.now();
    this.db.persist();
  }
}
