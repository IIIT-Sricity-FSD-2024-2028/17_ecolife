import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { InviteOrgUserDto, UpdateOrgUserDto } from './dto/org-user.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { OrgRole } from '../database/types';

const SALT_ROUNDS = 10;

@Injectable()
export class OrgUsersService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  async invite(actor: AuthenticatedOrgUser, dto: InviteOrgUserDto) {
    if (dto.role === 'CONTRIBUTOR' && !dto.departmentId) {
      throw new BadRequestException(
        'departmentId is required when inviting a Contributor — they must be scoped to exactly one department.',
      );
    }

    if (dto.departmentId) {
      const dept = this.db.store.departments.find(
        (d) => d.id === dto.departmentId && d.organizationId === actor.organizationId,
      );
      if (!dept) throw new BadRequestException('departmentId does not belong to your organization.');
    }

    const email = dto.email.trim().toLowerCase();
    const existing = this.db.store.orgUsers.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      // Don't reveal which organization an address belongs to.
      throw new ConflictException(
        existing.organizationId === actor.organizationId
          ? 'A user with this email already exists in your organization.'
          : 'This email address is already registered on Tropos and can’t be invited again.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, SALT_ROUNDS);
    const now = this.db.now();

    const newUser = {
      id: this.db.id(),
      organizationId: actor.organizationId,
      email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role as OrgRole,
      isOwner: false,
      isActive: true,
      departmentId: dto.departmentId ?? null,
      invitedById: actor.sub,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };
    this.db.store.orgUsers.push(newUser);
    this.db.persist();

    this.auditLog.log({
      organizationId: actor.organizationId,
      orgUserId: actor.sub,
      action: 'org_user.invited',
      entityType: 'org_user',
      entityId: newUser.id,
      metadata: { email: newUser.email, role: newUser.role },
    });

    return this.sanitize(newUser);
  }

  findAll(actor: AuthenticatedOrgUser) {
    return this.db.store.orgUsers
      .filter((u) => u.organizationId === actor.organizationId)
      .map((u) => this.sanitize(u));
  }

  findOne(actor: AuthenticatedOrgUser, id: string) {
    const user = this.db.store.orgUsers.find((u) => u.id === id && u.organizationId === actor.organizationId);
    if (!user) throw new NotFoundException('User not found.');
    return this.sanitize(user);
  }

  update(actor: AuthenticatedOrgUser, id: string, dto: UpdateOrgUserDto) {
    const target = this.db.store.orgUsers.find(
      (u) => u.id === id && u.organizationId === actor.organizationId,
    );
    if (!target) throw new NotFoundException('User not found.');

    // Only the Owner (or the user acting on themselves) can deactivate a
    // protected Owner account — prevents another Org Admin locking out the
    // account holder responsible for billing.
    if (target.isOwner && dto.isActive === false && actor.sub !== target.id) {
      throw new ForbiddenException('The organization Owner cannot be deactivated by another Org Admin.');
    }

    if (dto.role === 'CONTRIBUTOR' && !dto.departmentId && !target.departmentId) {
      throw new BadRequestException('A Contributor must be assigned to a department.');
    }

    if (dto.fullName !== undefined) target.fullName = dto.fullName;
    if (dto.role !== undefined) target.role = dto.role as OrgRole;
    if (dto.departmentId !== undefined) target.departmentId = dto.departmentId;
    if (dto.isActive !== undefined) target.isActive = dto.isActive;
    target.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: actor.organizationId,
      orgUserId: actor.sub,
      action: 'org_user.updated',
      entityType: 'org_user',
      entityId: id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return this.sanitize(target);
  }

  /** Never a hard delete — preserves the audit trail for everything this
   * user ever touched (submissions, approvals, reports). */
  deactivate(actor: AuthenticatedOrgUser, id: string) {
    return this.update(actor, id, { isActive: false });
  }

  private sanitize(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
