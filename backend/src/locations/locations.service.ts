import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class LocationsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  private assertDepartmentInOrg(user: AuthenticatedOrgUser, departmentId: string) {
    const dept = this.db.store.departments.find(
      (d) => d.id === departmentId && d.organizationId === user.organizationId,
    );
    if (!dept) throw new BadRequestException('departmentId does not belong to your organization.');
    return dept;
  }

  create(user: AuthenticatedOrgUser, dto: CreateLocationDto) {
    this.assertDepartmentInOrg(user, dto.departmentId);

    const location = {
      id: this.db.id(),
      departmentId: dto.departmentId,
      name: dto.name,
      address: dto.address ?? null,
      createdAt: this.db.now(),
    };
    this.db.store.locations.push(location);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'location.created',
      entityType: 'location',
      entityId: location.id,
      metadata: { name: location.name, departmentId: dto.departmentId },
    });

    return location;
  }

  /** Scoped by joining through department → organization, since Location
   * has no organizationId of its own. */
  findAll(user: AuthenticatedOrgUser, departmentId?: string) {
    const orgDeptIds = new Set(
      this.db.store.departments.filter((d) => d.organizationId === user.organizationId).map((d) => d.id),
    );
    let locations = this.db.store.locations.filter((l) => orgDeptIds.has(l.departmentId));
    if (departmentId) locations = locations.filter((l) => l.departmentId === departmentId);
    return locations;
  }

  private getInOrg(user: AuthenticatedOrgUser, id: string) {
    const location = this.db.store.locations.find((l) => l.id === id);
    if (!location) throw new NotFoundException('Location not found.');
    const dept = this.db.store.departments.find((d) => d.id === location.departmentId);
    if (!dept || dept.organizationId !== user.organizationId) {
      throw new NotFoundException('Location not found.');
    }
    return location;
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    return this.getInOrg(user, id);
  }

  update(user: AuthenticatedOrgUser, id: string, dto: UpdateLocationDto) {
    const location = this.getInOrg(user, id);
    if (dto.name !== undefined) location.name = dto.name;
    if (dto.address !== undefined) location.address = dto.address;
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'location.updated',
      entityType: 'location',
      entityId: id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return location;
  }

  remove(user: AuthenticatedOrgUser, id: string) {
    this.getInOrg(user, id);

    const hasRecords = this.db.store.resourceRecords.some((r) => r.locationId === id);
    if (hasRecords) {
      throw new ForbiddenException('This location has resource records attached and cannot be deleted.');
    }

    this.db.store.locations = this.db.store.locations.filter((l) => l.id !== id);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'location.deleted',
      entityType: 'location',
      entityId: id,
    });

    return { id };
  }
}
