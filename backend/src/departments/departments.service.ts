import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  create(user: AuthenticatedOrgUser, dto: CreateDepartmentDto) {
    const existing = this.db.store.departments.find(
      (d) => d.organizationId === user.organizationId && d.name === dto.name,
    );
    if (existing) {
      throw new ConflictException('A department with this name already exists in your organization.');
    }

    const now = this.db.now();
    const dept = {
      id: this.db.id(),
      organizationId: user.organizationId,
      name: dto.name,
      description: dto.description ?? null,
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
    if (dto.name !== undefined) dept.name = dto.name;
    if (dto.description !== undefined) dept.description = dto.description;
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

    const hasUsers = this.db.store.orgUsers.some((u) => u.departmentId === id && u.isActive);
    if (hasUsers) {
      throw new ForbiddenException(
        'This department still has active users assigned. Reassign or deactivate them first.',
      );
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
