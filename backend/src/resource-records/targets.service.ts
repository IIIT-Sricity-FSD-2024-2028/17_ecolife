import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateTargetDto } from './dto/target.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class TargetsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  /** Reviewer owns targets/methodology per the current role split — this
   * used to sit with Org Admin, but target-setting is domain/analytical
   * work, not account administration. */
  create(reviewer: AuthenticatedOrgUser, dto: CreateTargetDto) {
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
}
