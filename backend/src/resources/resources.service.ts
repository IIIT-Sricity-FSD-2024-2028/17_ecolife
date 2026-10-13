import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { CreateFactorVersionDto, CreateResourceTypeDto } from './dto/resource-type.dto';
import { AuthenticatedOrgUser, AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';

@Injectable()
export class ResourcesService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  // ---------------------------------------------------------------------
  // Resource types & units — Platform Admin manages, everyone can read
  // ---------------------------------------------------------------------
  createType(admin: AuthenticatedPlatformAdmin, dto: CreateResourceTypeDto) {
    if (!dto.units.includes(dto.defaultUnit)) {
      throw new BadRequestException('defaultUnit must be one of the provided units.');
    }
    if (this.db.store.resourceTypes.some((t) => t.name === dto.name)) {
      throw new ConflictException('A resource type with this name already exists.');
    }

    const now = this.db.now();
    const type = {
      id: this.db.id(),
      name: dto.name,
      category: dto.category as any,
      description: dto.description ?? null,
      evidenceThreshold: dto.evidenceThreshold ?? null,
      units: dto.units.map((unit) => ({ unit, isDefault: unit === dto.defaultUnit })),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.resourceTypes.push(type);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'resource_type.created',
      entityType: 'resource_type',
      entityId: type.id,
      metadata: { name: type.name },
    });

    return type;
  }

  /** Every org user needs this catalog to fill out a usage entry form. */
  findAllTypes() {
    return this.db.store.resourceTypes.filter((t) => t.isActive);
  }

  findOneType(id: string) {
    const type = this.db.store.resourceTypes.find((t) => t.id === id);
    if (!type) throw new NotFoundException('Resource type not found.');
    return type;
  }

  /** The validation rule that stops a Contributor entering electricity in liters. */
  isUnitCompatible(resourceTypeId: string, unit: string): boolean {
    const type = this.db.store.resourceTypes.find((t) => t.id === resourceTypeId);
    return !!type?.units.some((u) => u.unit === unit);
  }

  // ---------------------------------------------------------------------
  // Emission factor sources
  // ---------------------------------------------------------------------
  findAllSources() {
    return this.db.store.emissionFactorSources;
  }

  createSource(admin: AuthenticatedPlatformAdmin, name: string, publisher: string, referenceUrl?: string) {
    const source = {
      id: this.db.id(),
      name,
      publisher,
      referenceUrl: referenceUrl ?? null,
      createdAt: this.db.now(),
    };
    this.db.store.emissionFactorSources.push(source);
    this.db.persist();
    return source;
  }

  // ---------------------------------------------------------------------
  // Emission factor versions — global default (Platform Admin) or org
  // override (Reviewer, per the revised responsibility split: Reviewer
  // owns methodology/targets, not Org Admin).
  // ---------------------------------------------------------------------
  createFactorVersionGlobal(admin: AuthenticatedPlatformAdmin, dto: CreateFactorVersionDto) {
    return this.createFactorVersion(dto, admin.sub);
  }

  createFactorVersionOverride(reviewer: AuthenticatedOrgUser, dto: CreateFactorVersionDto) {
    if (!dto.notes?.trim()) {
      const message = 'Explain why this organization needs its own factor (for example the supplier, certificate or study it comes from).';
      throw new BadRequestException({ message, errors: [{ field: 'notes', message }] });
    }
    return this.createFactorVersion({ ...dto, organizationId: reviewer.organizationId }, null);
  }

  private createFactorVersion(dto: CreateFactorVersionDto, createdById: string | null) {
    this.findOneType(dto.resourceTypeId); // throws if invalid

    const version = {
      id: this.db.id(),
      resourceTypeId: dto.resourceTypeId,
      sourceId: dto.sourceId,
      organizationId: dto.organizationId ?? null,
      gas: dto.gas,
      factorValue: dto.factorValue,
      gwp: dto.gwp ?? 1,
      unit: dto.unit,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: null,
      isLocked: false,
      notes: dto.notes?.trim() || null,
      createdById,
      createdAt: this.db.now(),
    };
    this.db.store.emissionFactorVersions.push(version);
    this.db.persist();
    return version;
  }

  findFactorVersionsForType(resourceTypeId: string, organizationId?: string) {
    return this.db.store.emissionFactorVersions.filter(
      (f) => f.resourceTypeId === resourceTypeId && (f.organizationId === null || f.organizationId === organizationId),
    );
  }
}
