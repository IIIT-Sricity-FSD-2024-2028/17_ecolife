import { assertWithinPlan } from '../billing/plan-limits';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  create(user: AuthenticatedOrgUser, dto: CreateDepartmentDto) {
    assertWithinPlan(this.db, user.organizationId, 'departments');
    const existing = this.db.store.departments.find(
      (d) =>
        d.organizationId === user.organizationId &&
        d.name.trim().toLowerCase() === dto.name.trim().toLowerCase(),
    );
    if (existing) {
      throw new ConflictException('A department with this name already exists in your organization.');
    }

    const now = this.db.now();
    const dept = {
      id: this.db.id(),
      organizationId: user.organizationId,
      name: dto.name.trim(),
      description: dto.description ?? null,
      allowedResourceTypeIds: dto.allowedResourceTypeIds ? [...new Set(dto.allowedResourceTypeIds)] : [],
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.departments.push(dept);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'department.created',
      entityType: 'department',
      entityId: dept.id,
      metadata: { name: dept.name },
    });

    return dept;
  }

  /** Always scoped by organizationId — never trust a raw id alone. */
  findAll(user: AuthenticatedOrgUser) {
    return this.db.store.departments
      .filter((d) => d.organizationId === user.organizationId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    const dept = this.db.store.departments.find(
      (d) => d.id === id && d.organizationId === user.organizationId,
    );
    if (!dept) throw new NotFoundException('Department not found.');
    return dept;
  }

  update(user: AuthenticatedOrgUser, id: string, dto: UpdateDepartmentDto) {
    const dept = this.findOne(user, id);

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const duplicate = this.db.store.departments.some(
        (d) =>
          d.organizationId === user.organizationId &&
          d.id !== id &&
          d.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        throw new ConflictException(`A department named "${trimmedName}" already exists in your organization.`);
      }
      dept.name = trimmedName;
    }

    if (dto.description !== undefined) dept.description = dto.description;
    if (dto.allowedResourceTypeIds !== undefined) {
      dept.allowedResourceTypeIds = [...new Set(dto.allowedResourceTypeIds)];
    }
    dept.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'department.updated',
      entityType: 'department',
      entityId: id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return dept;
  }

  remove(user: AuthenticatedOrgUser, id: string) {
    this.findOne(user, id);

    const hasActiveUsers = this.db.store.orgUsers.some((u) => u.departmentId === id && u.isActive);
    if (hasActiveUsers) {
      throw new ForbiddenException(
        'This department still has active users assigned. Reassign or deactivate them first.',
      );
    }

    const hasRecords = this.db.store.resourceRecords.some((r) => r.departmentId === id);
    if (hasRecords) {
      throw new ForbiddenException('Cannot delete department with existing resource entries.');
    }

    const hasLocations = this.db.store.locations.some((l) => l.departmentId === id);
    if (hasLocations) {
      throw new ForbiddenException('Cannot delete department with assigned locations.');
    }

    const hasTargets = this.db.store.targets.some((t) => t.departmentId === id);
    if (hasTargets) {
      throw new ForbiddenException('Cannot delete department with assigned targets.');
    }

    // Detach any deactivated users pointing at this deleted department
    for (const u of this.db.store.orgUsers) {
      if (u.departmentId === id && !u.isActive) {
        u.departmentId = null;
        u.updatedAt = this.db.now();
      }
    }

    this.db.store.departments = this.db.store.departments.filter((d) => d.id !== id);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'department.deleted',
      entityType: 'department',
      entityId: id,
    });

    return { id };
  }
}
