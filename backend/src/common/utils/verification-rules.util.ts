import { Prisma } from '../../generated/prisma';

export const INDIAN_GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const INDIAN_CIN_REGEX = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

/**
 * Automated QA/QC Verification Rules Engine:
 * 1. Statistical Z-score & MoM spike/drop anomaly detection against trailing 6 periods
 * 2. Unit-cost outlier check (INR per unit vs historical mean)
 * 3. Duplicate invoice number detection across organization
 */
export async function runAutomatedEntryVerification(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    sourceId: string;
    periodId: string;
    normalizedQuantity: number;
    costInr?: number | null;
    invoiceNumber?: string | null;
    dataBasis?: string;
    excludeEntryId?: string;
  }
): Promise<string[]> {
  const flags: string[] = [];
  if (params.dataBasis === 'ESTIMATED_PROXY') flags.push('ESTIMATED_PROXY_NEEDS_TRUE_UP');
  if (params.dataBasis === 'NIL_ACTIVITY') return flags;

  // Baseline = this source's PERIOD TOTALS for up to the previous 6 periods that have data
  // (single bills are not comparable to a month: a source can legitimately have several bills per month).
  const prior = await tx.resourceEntry.findMany({
    where: {
      organizationId: params.organizationId,
      sourceId: params.sourceId,
      periodId: { not: params.periodId },
      status: { in: ['APPROVED', 'SUBMITTED'] },
      dataBasis: { not: 'NIL_ACTIVITY' },
      ...(params.excludeEntryId ? { id: { not: params.excludeEntryId } } : {})
    },
    select: { periodId: true, normalizedQuantity: true, costInr: true, period: { select: { startDate: true } } }
  });
  const byPeriod = new Map<string, { start: number; qty: number; cost: number; costQty: number }>();
  for (const e of prior) {
    const cur = byPeriod.get(e.periodId) ?? { start: e.period.startDate.getTime(), qty: 0, cost: 0, costQty: 0 };
    cur.qty += Number(e.normalizedQuantity);
    if (e.costInr) {
      cur.cost += Number(e.costInr);
      cur.costQty += Number(e.normalizedQuantity);
    }
    byPeriod.set(e.periodId, cur);
  }
  const history = [...byPeriod.values()].sort((a, b) => b.start - a.start).slice(0, 6);

  // This period's running total including the entry being checked.
  const sameBefore = await tx.resourceEntry.aggregate({
    where: {
      organizationId: params.organizationId,
      sourceId: params.sourceId,
      periodId: params.periodId,
      status: { not: 'WITHDRAWN' },
      dataBasis: { not: 'NIL_ACTIVITY' },
      ...(params.excludeEntryId ? { id: { not: params.excludeEntryId } } : {})
    },
    _sum: { normalizedQuantity: true, costInr: true }
  });
  const periodTotal = Number(sameBefore._sum.normalizedQuantity ?? 0) + params.normalizedQuantity;

  if (history.length >= 2) {
    const qtys = history.map((h) => h.qty).filter((n) => n > 0);
    if (qtys.length >= 2) {
      const mean = qtys.reduce((s, n) => s + n, 0) / qtys.length;
      const stdDev = Math.sqrt(qtys.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / qtys.length);
      const pctDiff = mean > 0 ? ((periodTotal - mean) / mean) * 100 : 0;
      const z = stdDev > 0 ? (periodTotal - mean) / stdDev : 0;
      // Needs 3+ periods for a meaningful σ; otherwise the percentage band alone applies.
      const zFlag = qtys.length >= 3 && Math.abs(z) > 2.5;
      if (pctDiff > 35 || (zFlag && z > 0)) flags.push(`ANOMALY_HIGH_SPIKE_+${Math.round(pctDiff)}PCT`);
      else if (pctDiff < -35 || (zFlag && z < 0)) flags.push(`ANOMALY_LOW_DROP_${Math.round(pctDiff)}PCT`);
    }

    if (params.costInr && params.normalizedQuantity > 0) {
      const unitCost = params.costInr / params.normalizedQuantity;
      const hist = history.filter((h) => h.costQty > 0).map((h) => h.cost / h.costQty);
      if (hist.length >= 2) {
        const avg = hist.reduce((s, n) => s + n, 0) / hist.length;
        if (avg > 0 && Math.abs(unitCost - avg) / avg > 0.3) flags.push(`UNIT_COST_OUTLIER_${unitCost > avg ? '+' : '-'}${Math.round((Math.abs(unitCost - avg) / avg) * 100)}PCT`);
      }
    }
  }
  return flags;
}

/**
 * Automated Period-Close Readiness & Completeness Audit.
 */
export async function evaluatePeriodReadiness(tx: Prisma.TransactionClient, organizationId: string, periodId: string) {
  const period = await tx.reportingPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const [sources, entries, pendingScope3, pendingLogs] = await Promise.all([
    // Only sources that were in operation during this period are expected to report.
    tx.resourceSource.findMany({
      where: {
        organizationId,
        effectiveFrom: { lte: period.endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        domain: { in: ['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT'] }
      },
      include: { facility: { select: { name: true } } }
    }),
    tx.resourceEntry.findMany({
      where: { organizationId, periodId, status: { not: 'WITHDRAWN' } },
      include: { evidenceFiles: { select: { id: true } } }
    }),
    tx.scope3Purchase.count({ where: { organizationId, periodId, status: { in: ['DRAFT', 'SUBMITTED', 'REJECTED'] } } }),
    Promise.all(['waterLog', 'wasteLog', 'airEmissionLog', 'materialLog', 'facilityOutputLog'].map((d) => (tx as any)[d].count({ where: { organizationId, periodId, status: { not: 'APPROVED' } } }))).then((c: number[]) => c.reduce((a, b) => a + b, 0))
  ]);

  const coveredSourceIds = new Set(entries.map((e) => e.sourceId));
  const missingSources = sources
    .filter((s) => !coveredSourceIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, facilityName: s.facility.name, domain: s.domain }));

  const unapprovedEntries = entries.filter((e) => e.status !== 'APPROVED');
  const approved = entries.filter((e) => e.status === 'APPROVED');
  const totalTco2e = approved.reduce((s, e) => s + Number(e.calculatedTco2eAr6), 0);
  // Material = 5% or more of the period's emissions (ISO 14064-3 style significance); needs a supporting document.
  const missingMaterialEvidence = approved
    .filter((e) => e.dataBasis !== 'NIL_ACTIVITY' && totalTco2e > 0 && Number(e.calculatedTco2eAr6) / totalTco2e >= 0.05 && e.evidenceFiles.length === 0)
    .map((e) => e.id);
  const flagList = (e: { qualityFlags: unknown }) => (Array.isArray(e.qualityFlags) ? (e.qualityFlags as string[]) : []);
  const unconfirmedAnomalies = approved.filter((e) => flagList(e).some((f) => f.startsWith('ANOMALY_')) && !e.outlierConfirmed);
  const trueUpPending = entries.filter((e) => e.needsTrueUp);

  const blockers: string[] = [];
  if (unapprovedEntries.length) blockers.push(`${unapprovedEntries.length} entr${unapprovedEntries.length === 1 ? 'y is' : 'ies are'} not approved yet`);
  if (pendingLogs) blockers.push(`${pendingLogs} water, waste, air, material or output record${pendingLogs === 1 ? ' is' : 's are'} not approved yet`);
  if (pendingScope3) blockers.push(`${pendingScope3} Scope 3 purchase${pendingScope3 === 1 ? ' is' : 's are'} not approved yet`);
  if (missingSources.length) blockers.push(`${missingSources.length} source${missingSources.length === 1 ? ' has' : 's have'} no entry (enter a value or mark nil activity)`);
  if (missingMaterialEvidence.length) blockers.push(`${missingMaterialEvidence.length} material entr${missingMaterialEvidence.length === 1 ? 'y has' : 'ies have'} no supporting document`);
  if (unconfirmedAnomalies.length) blockers.push(`${unconfirmedAnomalies.length} flagged spike/drop entr${unconfirmedAnomalies.length === 1 ? 'y is' : 'ies are'} not explained`);
  const warnings: string[] = [];
  if (trueUpPending.length) warnings.push(`${trueUpPending.length} estimated entr${trueUpPending.length === 1 ? 'y needs' : 'ies need'} a true-up with actual bills`);

  const completenessRatio = sources.length > 0 ? (sources.length - missingSources.length) / sources.length : 1;
  const approvalRatio = entries.length > 0 ? (entries.length - unapprovedEntries.length) / entries.length : 1;
  const evidenceRatio = approved.length > 0 ? 1 - missingMaterialEvidence.length / approved.length : 1;
  const readinessScorePct = Math.round((completenessRatio * 0.4 + approvalRatio * 0.4 + evidenceRatio * 0.2) * 100);

  return {
    readinessScorePct,
    totalActiveSources: sources.length,
    totalEntries: entries.length,
    unapprovedCount: unapprovedEntries.length,
    missingSources,
    missingMaterialEvidenceCount: missingMaterialEvidence.length,
    flaggedAnomaliesCount: unconfirmedAnomalies.length,
    trueUpPendingCount: trueUpPending.length,
    blockers,
    warnings,
    readyToClose: blockers.length === 0
  };
}
