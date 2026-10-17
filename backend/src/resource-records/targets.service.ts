import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class TargetsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  private assertDepartmentInOrganization(organizationId: string, departmentId: string | null | undefined) {
    if (!departmentId) return;
    const department = this.db.store.departments.find(
      (item) => item.id === departmentId && item.organizationId === organizationId,
    );
    if (!department) throw new BadRequestException('departmentId does not belong to your organization.');
  }

  /** Reviewer owns targets/methodology per the current role split. */
  create(reviewer: AuthenticatedOrgUser, dto: CreateTargetDto) {
    this.assertDepartmentInOrganization(reviewer.organizationId, dto.departmentId);
    const now = this.db.now();
    const target = {
      id: this.db.id(),
      organizationId: reviewer.organizationId,
      name: dto.name?.trim() || null,
      notes: dto.notes?.trim() || null,
      departmentId: dto.departmentId ?? null,
      resourceCategory: (dto.resourceCategory as any) ?? null,
      targetValue: dto.targetValue,
      metric: dto.metric,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      createdById: reviewer.sub,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.targets.push(target);
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'target.created',
      entityType: 'target',
      entityId: target.id,
    });

    return target;
  }

  findAll(user: AuthenticatedOrgUser) {
    return this.db.store.targets.filter((t) => t.organizationId === user.organizationId);
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    const target = this.db.store.targets.find((t) => t.id === id && t.organizationId === user.organizationId);
    if (!target) throw new NotFoundException('Target not found.');
    return target;
  }

  update(reviewer: AuthenticatedOrgUser, id: string, dto: UpdateTargetDto) {
    const target = this.findOne(reviewer, id);

    if (dto.departmentId !== undefined) {
      this.assertDepartmentInOrganization(reviewer.organizationId, dto.departmentId);
    }

    if (dto.name !== undefined) target.name = dto.name?.trim() || null;
    if (dto.notes !== undefined) target.notes = dto.notes?.trim() || null;
    if (dto.departmentId !== undefined) target.departmentId = dto.departmentId ?? null;
    if (dto.resourceCategory !== undefined) target.resourceCategory = (dto.resourceCategory as any) ?? null;
    if (dto.targetValue !== undefined) target.targetValue = dto.targetValue;
    if (dto.metric !== undefined) target.metric = dto.metric;

    const nextStart = dto.periodStart ?? target.periodStart;
    const nextEnd = dto.periodEnd ?? target.periodEnd;
    if (new Date(nextEnd) < new Date(nextStart)) {
      throw new BadRequestException('Period end cannot be before start date.');
    }
    target.periodStart = nextStart;
    target.periodEnd = nextEnd;
    target.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'target.updated',
      entityType: 'target',
      entityId: target.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return target;
  }

  remove(reviewer: AuthenticatedOrgUser, id: string) {
    this.findOne(reviewer, id);

    this.db.store.targets = this.db.store.targets.filter((t) => t.id !== id);
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'target.deleted',
      entityType: 'target',
      entityId: id,
    });

    return { id, deleted: true };
  }
}
