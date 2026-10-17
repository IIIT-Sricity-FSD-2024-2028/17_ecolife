import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { resolveFactors } from './factor-resolution';
import { convertQuantity } from './unit-conversion';

/**
 * Emissions (per gas) = Activity Data (Normalized Unit) x Emission Factor
 * CO2e = sum(Emissions x GWP) across every applicable gas.
 * Org-specific override factors take precedence over the global default
 * for the same resource type + effective date.
 * Implements GHG Protocol Scope 2 Guidance Dual Reporting (Location vs Market).
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

    const resourceType = this.db.store.resourceTypes.find((t) => t.id === record.resourceTypeId);

    let co2eKg = 0;
    for (const f of factorRows) {
      const normalizedQuantity = convertQuantity(record.quantity, record.unit, f.unit);
      co2eKg += normalizedQuantity * f.factorValue * f.gwp;
    }

    // GHG Protocol Scope 2 Dual Reporting (Location-Based vs Market-Based)
    const co2eLocationKg = co2eKg;
    let co2eMarketKg = co2eKg;
    if (resourceType?.category === 'ELECTRICITY') {
      if (record.marketInstrument === 'REC' || record.marketInstrument === 'PPA') {
        co2eMarketKg = 0; // Verified renewable instrument
      } else if (record.marketInstrument === 'GREEN_TARIFF') {
        co2eMarketKg = co2eKg * 0.1; // Green tariff with 90% renewable attribute
      }
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

    // Preserve prior results as historical provenance rather than replacing
    // them. All current readers select the one without supersededAt.
    const supersededAt = this.db.now();
    this.db.store.calculationResults
      .filter((c) => c.resourceRecordId === resourceRecordId && !c.supersededAt)
      .forEach((c) => (c.supersededAt = supersededAt));

    const result = {
      id: this.db.id(),
      resourceRecordId: record.id,
      factorVersionId: factorRows[0].id,
      co2eKg,
      co2eLocationKg,
      co2eMarketKg,
      costOfUsage,
      savingsVsBaseline,
      carbonExposure,
      calculatedAt: this.db.now(),
      recalculatedCount: 0,
      supersededAt: null,
      provenance: {
        formulaVersion: 'ghg-activity-data-times-factor-times-gwp/v2-dual-scope2',
        recordInput: { quantity: record.quantity, unit: record.unit, cost: record.cost, periodStart: record.periodStart, periodEnd: record.periodEnd },
        factors: factorRows.map((factor) => ({ id: factor.id, sourceId: factor.sourceId, gas: factor.gas, factorValue: factor.factorValue, gwp: factor.gwp, unit: factor.unit })),
      },
    };
    this.db.store.calculationResults.push(result);
    this.db.persist();

    return result;
  }

  /** Compares usage against the org's Target for the same department (or org-wide) +
   * resource category + overlapping period, choosing deterministically if multiple match. */
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

    const matching = this.db.store.targets.filter(
      (t) =>
        t.organizationId === record.organizationId &&
        (t.departmentId === record.departmentId || !t.departmentId) &&
        (t.resourceCategory === null || t.resourceCategory === resourceType.category) &&
        t.metric === 'usage' &&
        t.periodStart <= record.periodStart &&
        t.periodEnd >= record.periodEnd,
    );

    if (matching.length === 0) return null;

    // Deterministic selection:
    // 1. Department-specific target first over org-wide
    // 2. Category-specific target first over any-category
    // 3. Narrowest date range
    // 4. Most recently created
    matching.sort((a, b) => {
      const aDept = a.departmentId ? 0 : 1;
      const bDept = b.departmentId ? 0 : 1;
      if (aDept !== bDept) return aDept - bDept;

      const aCat = a.resourceCategory ? 0 : 1;
      const bCat = b.resourceCategory ? 0 : 1;
      if (aCat !== bCat) return aCat - bCat;

      const aSpan = new Date(a.periodEnd).getTime() - new Date(a.periodStart).getTime();
      const bSpan = new Date(b.periodEnd).getTime() - new Date(b.periodStart).getTime();
      if (aSpan !== bSpan) return aSpan - bSpan;

      return b.createdAt.localeCompare(a.createdAt);
    });

    const target = matching[0];
    return target.targetValue - record.quantity;
  }

  /** Manual recalculation — e.g. after a factor correction or amendment. */
  recalculate(resourceRecordId: string) {
    const existing = this.db.store.calculationResults.find((c) => c.resourceRecordId === resourceRecordId && !c.supersededAt);
    const previousCount = existing?.recalculatedCount ?? 0;

    const fresh = this.calculateForRecord(resourceRecordId);
    if (!fresh) {
      throw new BadRequestException('No applicable emission factor found for this entry.');
    }

    fresh.recalculatedCount = previousCount + 1;
    this.db.persist();
    return fresh;
  }
}
