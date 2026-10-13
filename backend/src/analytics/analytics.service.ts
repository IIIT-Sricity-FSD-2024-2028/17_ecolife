import { Injectable } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { EmissionsQueryDto } from './analytics.dto';

/**
 * Read-only roll-ups over LOCKED (approved) records and their stored
 * calculation results. Only approved data is counted, so the numbers match
 * what a generated report would contain.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DbService, private readonly views: ViewsService) {}

  emissions(user: AuthenticatedOrgUser, q: EmissionsQueryDto) {
    const s = this.db.store;
    const records = s.resourceRecords.filter(
      (r) =>
        r.organizationId === user.organizationId &&
        r.status === 'LOCKED' &&
        (!q.departmentId || r.departmentId === q.departmentId) &&
        (!q.from || r.periodStart >= q.from) &&
        (!q.to || r.periodEnd <= q.to),
    );

    const rows = records.flatMap((record) => {
      const calc = s.calculationResults.find((c) => c.resourceRecordId === record.id);
      return calc ? [{ record, calc }] : [];
    });

    const totals = { co2eKg: 0, cost: 0, entries: rows.length };
    const byMonth = new Map<string, { co2eKg: number; cost: number }>();
    const byDept = new Map<string, { co2eKg: number; cost: number; entries: number }>();

    for (const { record, calc } of rows) {
      totals.co2eKg += calc.co2eKg;
      totals.cost += calc.costOfUsage ?? 0;

      const month = record.periodStart.slice(0, 7);
      const m = byMonth.get(month) ?? { co2eKg: 0, cost: 0 };
      m.co2eKg += calc.co2eKg;
      m.cost += calc.costOfUsage ?? 0;
      byMonth.set(month, m);

      const d = byDept.get(record.departmentId) ?? { co2eKg: 0, cost: 0, entries: 0 };
      d.co2eKg += calc.co2eKg;
      d.cost += calc.costOfUsage ?? 0;
      d.entries += 1;
      byDept.set(record.departmentId, d);
    }

    const trend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    // Actual vs. target. A department target is measured on that department's
    // approved entries; an org-wide target on the whole organization's.
    const measure = (t: (typeof s.targets)[number], departmentId: string | null) => {
      const inScope = s.resourceRecords.filter((r) => {
        if (r.organizationId !== user.organizationId || r.status !== 'LOCKED') return false;
        if (departmentId && r.departmentId !== departmentId) return false;
        if (r.periodStart < t.periodStart || r.periodEnd > t.periodEnd) return false;
        if (t.resourceCategory) {
          const type = s.resourceTypes.find((x) => x.id === r.resourceTypeId);
          if (type?.category !== t.resourceCategory) return false;
        }
        return true;
      });
      let actual = 0;
      for (const r of inScope) {
        const c = s.calculationResults.find((x) => x.resourceRecordId === r.id);
        if (t.metric === 'usage') actual += r.quantity;
        else if (t.metric === 'cost') actual += r.cost ?? 0;
        else if (t.metric === 'emissions') actual += c?.co2eKg ?? 0;
      }
      return {
        id: t.id,
        scope: t.departmentId ? 'DEPARTMENT' : 'ORG_WIDE',
        resourceCategory: t.resourceCategory,
        metric: t.metric,
        targetValue: t.targetValue,
        periodStart: t.periodStart,
        periodEnd: t.periodEnd,
        actual,
        percentOfTarget: t.targetValue > 0 ? (actual / t.targetValue) * 100 : null,
      };
    };

    const orgTargets = s.targets
      .filter((t) => t.organizationId === user.organizationId && t.departmentId === null)
      .map((t) => measure(t, null));

    const departments = s.departments
      .filter((d) => d.organizationId === user.organizationId && (!q.departmentId || d.id === q.departmentId))
      .map((d) => {
        const agg = byDept.get(d.id) ?? { co2eKg: 0, cost: 0, entries: 0 };
        const targets = s.targets
          .filter((t) => t.organizationId === user.organizationId && t.departmentId === d.id)
          .map((t) => measure(t, d.id));
        return { departmentId: d.id, name: d.name, ...agg, targets };
      });

    // Lineage: trace each emissions figure back to the factor version(s) used.
    const lineage = rows
      .map(({ record }) => this.views.record(record))
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((v) => ({
        recordId: v.id,
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        departmentName: v.departmentName,
        resourceTypeName: v.resourceTypeName,
        quantity: v.quantity,
        unit: v.unit,
        co2eKg: (v.calculation as any)?.co2eKg ?? 0,
        recalculatedCount: (v.calculation as any)?.recalculatedCount ?? 0,
        factorScope: (v.calculation as any)?.factorScope ?? 'NONE',
        factors: (v.calculation as any)?.factors ?? [],
      }));

    return { totals, trend, departments, orgTargets, lineage };
  }
}
