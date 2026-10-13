import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { resolveFactors } from './factor-resolution';

/**
 * Emissions (per gas) = Activity Data x Emission Factor
 * CO2e = sum(Emissions x GWP) across every applicable gas.
 * Org-specific override factors take precedence over the global default
 * for the same resource type + effective date.
 */
@Injectable()
export class CalculationsService {
  private readonly logger = new Logger(CalculationsService.name);

  constructor(private readonly db: DbService) {}

  calculateForRecord(resourceRecordId: string) {
    const record = this.db.store.resourceRecords.find((r) => r.id === resourceRecordId);
    if (!record) return null;

    const { rows: factorRows } = resolveFactors(this.db.store, record);

    if (factorRows.length === 0) {
      this.logger.warn(`No emission factor found for resource type ${record.resourceTypeId}`);
      return null;
    }

    let co2eKg = 0;
    for (const f of factorRows) {
      co2eKg += record.quantity * f.factorValue * f.gwp;
    }

    // Lock every factor version used — future corrections must create a
    // new version rather than editing one already used in a calculation.
    for (const f of factorRows) {
      f.isLocked = true;
    }

    const org = this.db.store.organizations.find((o) => o.id === record.organizationId);
    const costOfUsage = record.cost ?? null;
    const savingsVsBaseline = this.computeSavingsVsBaseline(record);
    const carbonExposure = org ? (co2eKg / 1000) * org.carbonPricePerTon : 0;

    // Replace any existing result for this record (used by manual recalc).
    this.db.store.calculationResults = this.db.store.calculationResults.filter(
      (c) => c.resourceRecordId !== resourceRecordId,
    );

    const result = {
      id: this.db.id(),
      resourceRecordId: record.id,
      factorVersionId: factorRows[0].id,
      co2eKg,
      costOfUsage,
      savingsVsBaseline,
      carbonExposure,
      calculatedAt: this.db.now(),
      recalculatedCount: 0,
    };
    this.db.store.calculationResults.push(result);
    this.db.persist();

    return result;
  }

  /** Compares usage against the org's Target for the same department +
   * resource category + overlapping period, if one exists. */
  private computeSavingsVsBaseline(record: {
    organizationId: string;
    departmentId: string;
    resourceTypeId: string;
    quantity: number;
    periodStart: string;
    periodEnd: string;
  }): number | null {
    const resourceType = this.db.store.resourceTypes.find((t) => t.id === record.resourceTypeId);
    if (!resourceType) return null;

    const target = this.db.store.targets.find(
      (t) =>
        t.organizationId === record.organizationId &&
        t.departmentId === record.departmentId &&
        t.resourceCategory === resourceType.category &&
        t.metric === 'usage' &&
        t.periodStart <= record.periodStart &&
        t.periodEnd >= record.periodEnd,
    );

    if (!target) return null;
    return target.targetValue - record.quantity;
  }

  /** Manual recalculation — e.g. after a factor correction or amendment. */
  recalculate(resourceRecordId: string) {
    const existing = this.db.store.calculationResults.find((c) => c.resourceRecordId === resourceRecordId);
    const previousCount = existing?.recalculatedCount ?? 0;

    const fresh = this.calculateForRecord(resourceRecordId);
    if (fresh) {
      fresh.recalculatedCount = previousCount + 1;
      this.db.persist();
    }
    return fresh;
  }
}
