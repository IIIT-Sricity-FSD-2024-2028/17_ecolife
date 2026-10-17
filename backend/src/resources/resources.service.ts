import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import {
  CreateFactorVersionDto,
  CreateResourceTypeDto,
  UpdateFactorSourceDto,
  UpdateFactorVersionDto,
  UpdateResourceTypeDto,
} from './dto/resource-type.dto';
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
    if (this.db.store.resourceTypes.some((t) => t.name.toLowerCase() === dto.name.toLowerCase())) {
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

  updateType(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdateResourceTypeDto) {
    const type = this.findOneType(id);

    if (dto.name && dto.name.trim() !== type.name) {
      const trimmed = dto.name.trim();
      if (this.db.store.resourceTypes.some((t) => t.id !== id && t.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new ConflictException('A resource type with this name already exists.');
      }
      type.name = trimmed;
    }

    if (dto.category) {
      type.category = dto.category as any;
    }

    if (dto.description !== undefined) {
      type.description = dto.description?.trim() || null;
    }

    if (dto.evidenceThreshold !== undefined) {
      type.evidenceThreshold = dto.evidenceThreshold == null ? null : Number(dto.evidenceThreshold);
    }

    if (dto.units || dto.defaultUnit) {
      const unitsList = dto.units ?? type.units.map((u) => u.unit);
      const defaultUnit = dto.defaultUnit ?? (type.units.find((u) => u.isDefault)?.unit || unitsList[0]);

      if (!unitsList.includes(defaultUnit)) {
        throw new BadRequestException('defaultUnit must be one of the provided units.');
      }

      // Safeguard: do not allow removing units actively in use by resource records
      const currentUnits = type.units.map((u) => u.unit);
      const removedUnits = currentUnits.filter((u) => !unitsList.includes(u));
      if (removedUnits.length > 0) {
        const inUse = this.db.store.resourceRecords.some(
          (r) => r.resourceTypeId === id && removedUnits.includes(r.unit),
        );
        if (inUse) {
          throw new BadRequestException(
            `Cannot remove unit(s) [${removedUnits.join(', ')}] because historical or active usage records currently use them.`,
          );
        }
      }

      type.units = unitsList.map((unit) => ({ unit, isDefault: unit === defaultUnit }));
    }

    if (dto.isActive !== undefined) {
      type.isActive = dto.isActive;
    }

    type.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'resource_type.updated',
      entityType: 'resource_type',
      entityId: type.id,
      metadata: { name: type.name, isActive: type.isActive },
    });

    return type;
  }

  deleteType(admin: AuthenticatedPlatformAdmin, id: string) {
    const type = this.findOneType(id);
    const hasRecords = this.db.store.resourceRecords.some((r) => r.resourceTypeId === id);
    const hasFactors = this.db.store.emissionFactorVersions.some((f) => f.resourceTypeId === id);

    if (hasRecords || hasFactors) {
      type.isActive = false;
      type.updatedAt = this.db.now();
      this.db.persist();

      this.auditLog.log({
        platformAdminId: admin.sub,
        action: 'resource_type.retired',
        entityType: 'resource_type',
        entityId: type.id,
        metadata: { name: type.name, reason: 'Retired due to linked usage records or factors' },
      });

      return {
        message: 'Resource type has linked usage records or emission factors and has been retired (deactivated) to protect calculation integrity.',
        retired: true,
        data: type,
      };
    }

    this.db.store.resourceTypes = this.db.store.resourceTypes.filter((t) => t.id !== id);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'resource_type.deleted',
      entityType: 'resource_type',
      entityId: id,
      metadata: { name: type.name },
    });

    return {
      message: 'Resource type permanently deleted.',
      retired: false,
      data: null,
    };
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

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'factor_source.created',
      entityType: 'factor_source',
      entityId: source.id,
      metadata: { name: source.name },
    });

    return source;
  }

  updateSource(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdateFactorSourceDto) {
    const source = this.db.store.emissionFactorSources.find((s) => s.id === id);
    if (!source) throw new NotFoundException('Factor source not found.');

    if (dto.name) source.name = dto.name.trim();
    if (dto.publisher) source.publisher = dto.publisher.trim();
    if (dto.referenceUrl !== undefined) source.referenceUrl = dto.referenceUrl?.trim() || null;

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'factor_source.updated',
      entityType: 'factor_source',
      entityId: source.id,
      metadata: { name: source.name },
    });

    return source;
  }

  deleteSource(admin: AuthenticatedPlatformAdmin, id: string) {
    const source = this.db.store.emissionFactorSources.find((s) => s.id === id);
    if (!source) throw new NotFoundException('Factor source not found.');

    const referencingCount = this.db.store.emissionFactorVersions.filter((f) => f.sourceId === id).length;
    if (referencingCount > 0) {
      throw new BadRequestException(
        `Cannot delete factor source "${source.name}" because it is currently referenced by ${referencingCount} emission factor version(s). Please delete or reassign those factors first.`,
      );
    }

    this.db.store.emissionFactorSources = this.db.store.emissionFactorSources.filter((s) => s.id !== id);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'factor_source.deleted',
      entityType: 'factor_source',
      entityId: id,
      metadata: { name: source.name },
    });

    return { message: 'Factor source deleted.' };
  }

  // ---------------------------------------------------------------------
  // Emission factor versions — global default (Platform Admin) or org
  // override (Reviewer, per the revised responsibility split: Reviewer
  // owns methodology/targets, not Org Admin).
  // ---------------------------------------------------------------------
  createFactorVersionGlobal(admin: AuthenticatedPlatformAdmin, dto: CreateFactorVersionDto) {
    // The global route can never create an org-scoped factor: that path (Reviewer override) requires a justification.
    return this.createFactorVersion({ ...dto, organizationId: undefined }, admin.sub);
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
    if (!this.db.store.emissionFactorSources.some((s) => s.id === dto.sourceId)) {
      throw new BadRequestException({ message: 'Unknown factor source.', errors: [{ field: 'sourceId', message: 'Unknown factor source.' }] });
    }

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

    this.auditLog.log({
      platformAdminId: createdById,
      action: 'factor_version.created',
      entityType: 'factor_version',
      entityId: version.id,
      metadata: { resourceTypeId: version.resourceTypeId, gas: version.gas, factorValue: version.factorValue },
    });

    return version;
  }

  updateFactorVersion(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdateFactorVersionDto) {
    const factor = this.db.store.emissionFactorVersions.find((f) => f.id === id);
    if (!factor) throw new NotFoundException('Emission factor version not found.');

    if (factor.isLocked) {
      const calculationChanged =
        (dto.factorValue !== undefined && Number(dto.factorValue) !== factor.factorValue) ||
        (dto.gwp !== undefined && Number(dto.gwp) !== factor.gwp) ||
        (dto.gas !== undefined && dto.gas.trim() !== factor.gas) ||
        (dto.unit !== undefined && dto.unit.trim() !== factor.unit) ||
        (dto.effectiveFrom !== undefined && dto.effectiveFrom !== factor.effectiveFrom) ||
        (dto.sourceId !== undefined && dto.sourceId !== factor.sourceId);

      if (calculationChanged) {
        throw new BadRequestException(
          'This factor version has already been used in emissions calculations and is locked. Calculation parameters cannot be modified to protect historical audit integrity. Publish a new factor version instead. Only notes may be updated.',
        );
      }

      if (dto.notes !== undefined) {
        factor.notes = dto.notes?.trim() || null;
      }
    } else {
      if (dto.sourceId) {
        if (!this.db.store.emissionFactorSources.some((s) => s.id === dto.sourceId)) {
          throw new BadRequestException({ message: 'Unknown factor source.', errors: [{ field: 'sourceId', message: 'Unknown factor source.' }] });
        }
        factor.sourceId = dto.sourceId;
      }
      if (dto.gas) factor.gas = dto.gas.trim();
      if (dto.factorValue !== undefined) factor.factorValue = Number(dto.factorValue);
      if (dto.gwp !== undefined) factor.gwp = Number(dto.gwp);
      if (dto.unit) factor.unit = dto.unit.trim();
      if (dto.effectiveFrom) factor.effectiveFrom = dto.effectiveFrom;
      if (dto.notes !== undefined) factor.notes = dto.notes?.trim() || null;
    }

    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'factor_version.updated',
      entityType: 'factor_version',
      entityId: factor.id,
      metadata: { resourceTypeId: factor.resourceTypeId, gas: factor.gas, isLocked: factor.isLocked },
    });

    return factor;
  }

  deleteFactorVersion(admin: AuthenticatedPlatformAdmin, id: string) {
    const factor = this.db.store.emissionFactorVersions.find((f) => f.id === id);
    if (!factor) throw new NotFoundException('Emission factor version not found.');

    if (factor.isLocked) {
      throw new BadRequestException(
        'Cannot delete a locked emission factor version that has already been used in calculations. Historical calculation integrity must be preserved.',
      );
    }

    this.db.store.emissionFactorVersions = this.db.store.emissionFactorVersions.filter((f) => f.id !== id);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'factor_version.deleted',
      entityType: 'factor_version',
      entityId: id,
      metadata: { resourceTypeId: factor.resourceTypeId, gas: factor.gas },
    });

    return { message: 'Emission factor version deleted.' };
  }

  findAllFactorVersions(organizationId?: string) {
    return this.db.store.emissionFactorVersions.filter(
      (f) => f.organizationId === null || f.organizationId === organizationId,
    );
  }

  findFactorVersionsForType(resourceTypeId: string, organizationId?: string) {
    return this.db.store.emissionFactorVersions.filter(
      (f) => f.resourceTypeId === resourceTypeId && (f.organizationId === null || f.organizationId === organizationId),
    );
  }
}
