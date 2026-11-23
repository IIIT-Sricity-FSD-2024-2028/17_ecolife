import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { z } from 'zod';
import { assertFactorUsable, calculateResourceEntry } from '../../common/utils/calculation.util';
import { runAutomatedEntryVerification } from '../../common/utils/verification-rules.util';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Use a date like 2026-04-30').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');
const MAX_QTY = 1_000_000_000;

export const entryFieldsSchema = z.object({
  periodId: z.string().min(1),
  sourceId: z.string().min(1),
  factorId: z.string().min(1).optional(),
  dataBasis: z.enum(['ACTUAL_METERED', 'SUPPLIER_PRIMARY', 'SPEND_BASED', 'ESTIMATED_PROXY', 'NIL_ACTIVITY']).default('ACTUAL_METERED'),
  rawQuantity: z.number().finite().nonnegative().max(MAX_QTY),
  rawUnit: z.string().trim().min(1).max(20),
  costInr: z.number().finite().nonnegative().max(1e12).optional(),
  invoiceNumber: z.string().trim().min(1).max(80).optional(),
  billingStartDate: dateStr.optional(),
  billingEndDate: dateStr.optional(),
  calorificBasis: z.enum(['NCV', 'GCV_CONVERTED']).default('NCV'),
  openingStockQty: z.number().finite().nonnegative().optional(),
  purchasedQty: z.number().finite().nonnegative().optional(),
  closingStockQty: z.number().finite().nonnegative().optional(),
  nonEnergyDeductedQty: z.number().finite().nonnegative().optional(),
  labNcvOverride: z.number().finite().positive().optional(),
  labDensityOverride: z.number().finite().positive().max(5).optional(),
  grossGridImportKwh: z.number().finite().nonnegative().max(MAX_QTY).optional(),
  onsiteSolarSelfConsumedKwh: z.number().finite().nonnegative().max(MAX_QTY).optional(),
  solarExportedKwh: z.number().finite().nonnegative().max(MAX_QTY).optional(),
  estimationMethod: z.string().trim().max(500).optional(),
  refrigerantEquipmentId: z.string().min(1).optional(),
  refrigerantMethod: z.enum(['MATERIAL_BALANCE', 'SIMPLIFIED_MATERIAL_BALANCE', 'SALES_BASED', 'SCREENING']).optional(),
  externalRefId: z.string().trim().min(1).max(120).optional(),
  evidenceFileId: z.string().min(1).optional()
});
export type EntryFields = z.infer<typeof entryFieldsSchema>;

/** Domains that are recorded as activity entries (water, waste and air use their own logs). */
export const ENTRY_DOMAINS = ['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'RAW_MATERIAL'];

const bad = (m: string): never => {
  throw new BadRequestException(m);
};

export async function loadOpenPeriod(tx: Prisma.TransactionClient, periodId: string) {
  const period = await tx.reportingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new NotFoundException('Reporting period not found.');
  if (period.status !== 'OPEN' && period.status !== 'REOPENED') {
    throw new ConflictException(`${period.label} is ${period.status.toLowerCase().replace('_', ' ')}. Entries can only change while a period is open; ask a lead to reopen it with a reason.`);
  }
  return period;
}

/**
 * Single place that turns user input into a validated, calculated entry.
 * Used by manual create, edit, API ingest and CSV import so every route obeys the same rules.
 */
export async function buildEntry(
  tx: Prisma.TransactionClient,
  orgId: string,
  input: EntryFields,
  opts: { excludeEntryId?: string; skipDuplicateChecks?: boolean } = {}
) {
  const period = await loadOpenPeriod(tx, input.periodId);
  const source = await tx.resourceSource.findUnique({ where: { id: input.sourceId }, include: { facility: true } });
  if (!source) throw new NotFoundException('Resource source not found.');
  if (!ENTRY_DOMAINS.includes(source.domain)) bad(`${source.name} records ${source.domain.toLowerCase().replace('_', ' ')} on its own page, not as an activity entry.`);
  if (source.effectiveFrom > period.endDate || (source.effectiveTo && source.effectiveTo < period.startDate)) {
    bad(`${source.name} was not in operation during ${period.label}.`);
  }
  if (source.facility.approvalStatus !== 'APPROVED') bad(`${source.facility.name} is awaiting approval and cannot receive entries yet.`);

  let equipment: { id: string; facilityId: string; refrigerantCode: string } | null = null;
  if (input.refrigerantEquipmentId) {
    equipment = await tx.refrigerantEquipment.findFirst({ where: { id: input.refrigerantEquipmentId, organizationId: orgId }, select: { id: true, facilityId: true, refrigerantCode: true } });
    if (!equipment) bad('Refrigerant equipment not found.');
    else if (equipment.facilityId !== source.facilityId) bad('That equipment belongs to a different facility than this source.');
  }
  let factorId = input.factorId || source.defaultFactorId;
  if (source.domain === 'REFRIGERANT' && equipment && !input.factorId) {
    // Pick the published factor for this equipment's gas, whatever the source default says.
    const byGas = await tx.emissionFactor.findFirst({ where: { hfcGasCode: equipment.refrigerantCode, status: 'PUBLISHED', domain: 'REFRIGERANT' }, orderBy: { validFrom: 'desc' } });
    if (!byGas) bad(`No published emission factor exists for ${equipment.refrigerantCode}. Ask the platform administrator to add it.`);
    factorId = byGas!.id;
  }
  if (!factorId) bad('This source has no default emission factor. Choose a factor to continue.');
  const factor = await tx.emissionFactor.findUnique({ where: { id: factorId! } });
  if (!factor) throw new NotFoundException('Emission factor not found.');
  assertFactorUsable(factor, source, period);
  if (equipment && factor.hfcGasCode !== equipment.refrigerantCode) bad(`This equipment uses ${equipment.refrigerantCode} but the factor is for ${factor.hfcGasCode ?? 'another gas'}.`);

  // Quantity vs basis
  if (input.dataBasis === 'NIL_ACTIVITY') {
    if (input.rawQuantity !== 0) bad('Nil activity means nothing was consumed, so the quantity must be 0.');
  } else if (input.rawQuantity === 0 && input.grossGridImportKwh == null) {
    bad("A quantity of 0 must be recorded as 'Nil activity' so reviewers know it is deliberate, not a missing reading.");
  }
  if (input.dataBasis === 'ESTIMATED_PROXY' && (!input.estimationMethod || input.estimationMethod.length < 10)) {
    bad('Describe how the estimate was made (at least 10 characters). Auditors will ask.');
  }
  if (input.dataBasis === 'SPEND_BASED' && input.costInr == null) bad('A spend-based entry needs the amount spent (₹).');
  if (source.domain === 'REFRIGERANT' && !input.refrigerantMethod) bad('Choose how the refrigerant loss was determined (material balance, simplified, sales-based or screening).');
  if ((input.billingStartDate == null) !== (input.billingEndDate == null)) bad('Give both the bill start date and end date, or neither.');
  let billStart: Date | undefined;
  let billEnd: Date | undefined;
  const flags: string[] = [];
  if (input.billingStartDate && input.billingEndDate) {
    billStart = new Date(input.billingStartDate);
    billEnd = new Date(input.billingEndDate);
    if (billEnd < billStart) bad('The bill end date is before its start date.');
    if ((billEnd.getTime() - billStart.getTime()) / 86400000 > 400) bad('A single bill cannot span more than 400 days.');
    if (billEnd < period.startDate || billStart > period.endDate) flags.push('BILLING_PERIOD_OUTSIDE_REPORTING_PERIOD');
  } else if (source.domain === 'ELECTRICITY_THERMAL' && input.dataBasis === 'ACTUAL_METERED') {
    flags.push('BILLING_PERIOD_MISSING');
  }

  if (!opts.skipDuplicateChecks) {
    const exclude = opts.excludeEntryId ? { id: { not: opts.excludeEntryId } } : {};
    if (input.invoiceNumber) {
      const dup = await tx.resourceEntry.findFirst({
        where: { organizationId: orgId, sourceId: source.id, invoiceNumber: { equals: input.invoiceNumber, mode: 'insensitive' }, status: { not: 'WITHDRAWN' }, ...exclude },
        select: { id: true }
      });
      if (dup) throw new ConflictException(`Invoice ${input.invoiceNumber} is already recorded for ${source.name} (entry ${dup.id}). Withdraw that entry first if it was wrong.`);
    }
    if (billStart && billEnd) {
      const overlap = await tx.resourceEntry.findFirst({
        where: {
          organizationId: orgId,
          sourceId: source.id,
          status: { not: 'WITHDRAWN' },
          billingStartDate: { lte: billEnd },
          billingEndDate: { gte: billStart },
          ...exclude
        },
        select: { id: true, billingStartDate: true, billingEndDate: true }
      });
      if (overlap) throw new ConflictException(`This bill overlaps another bill already entered for ${source.name} (${overlap.billingStartDate?.toISOString().slice(0, 10)} to ${overlap.billingEndDate?.toISOString().slice(0, 10)}). Entering both would count the same days twice.`);
    }
  }

  let shareFraction: number | null = null;
  if (source.scope === 'SCOPE_2' && source.facility.isSharedBuilding && source.facility.floorAreaSharePct != null) {
    shareFraction = Number(source.facility.floorAreaSharePct) / 100;
  }

  const calc = await calculateResourceEntry(tx, {
    factorId: factor.id,
    rawQuantity: input.rawQuantity,
    rawUnit: input.rawUnit,
    domain: source.domain,
    calorificBasis: input.calorificBasis,
    openingStockQty: input.openingStockQty,
    purchasedQty: input.purchasedQty,
    closingStockQty: input.closingStockQty,
    nonEnergyDeductedQty: input.nonEnergyDeductedQty,
    labNcvOverride: input.labNcvOverride,
    labDensityOverride: input.labDensityOverride,
    shareFraction,
    grossGridImportKwh: input.grossGridImportKwh,
    onsiteSolarSelfConsumedKwh: input.onsiteSolarSelfConsumedKwh
  });

  const autoFlags = await runAutomatedEntryVerification(tx, {
    organizationId: orgId,
    sourceId: source.id,
    periodId: period.id,
    normalizedQuantity: calc.normalizedQuantity,
    costInr: input.costInr,
    invoiceNumber: input.invoiceNumber,
    dataBasis: input.dataBasis,
    excludeEntryId: opts.excludeEntryId
  });

  const data = {
    periodId: period.id,
    sourceId: source.id,
    factorId: factor.id,
    dataBasis: input.dataBasis,
    needsTrueUp: input.dataBasis === 'ESTIMATED_PROXY',
    estimationMethod: input.estimationMethod ?? null,
    dataQualityTier: ({ ACTUAL_METERED: 1, SUPPLIER_PRIMARY: 2, SPEND_BASED: 4, ESTIMATED_PROXY: 4, NIL_ACTIVITY: 1 } as const)[input.dataBasis],
    rawQuantity: input.rawQuantity,
    rawUnit: input.rawUnit,
    costInr: input.costInr ?? null,
    invoiceNumber: input.invoiceNumber ?? null,
    billingStartDate: billStart ?? null,
    billingEndDate: billEnd ?? null,
    calorificBasis: input.calorificBasis,
    openingStockQty: input.openingStockQty ?? null,
    purchasedQty: input.purchasedQty ?? null,
    closingStockQty: input.closingStockQty ?? null,
    nonEnergyDeductedQty: input.nonEnergyDeductedQty ?? null,
    labNcvOverride: input.labNcvOverride ?? null,
    labDensityOverride: input.labDensityOverride ?? null,
    grossGridImportKwh: input.grossGridImportKwh ?? null,
    onsiteSolarSelfConsumedKwh: input.onsiteSolarSelfConsumedKwh ?? null,
    solarExportedKwh: input.solarExportedKwh ?? null,
    refrigerantEquipmentId: input.refrigerantEquipmentId ?? null,
    refrigerantMethod: input.refrigerantMethod ?? null,
    externalRefId: input.externalRefId ?? null,
    ...calc,
    qualityFlags: [...new Set([...calc.qualityFlags, ...flags, ...autoFlags])]
  };
  return { data, source, period, factor };
}

/** Flags that must be explained before an entry can be submitted. */
export function anomalyFlags(flags: unknown): string[] {
  return (Array.isArray(flags) ? (flags as string[]) : []).filter((f) => f.startsWith('ANOMALY_') || f.startsWith('UNIT_COST_OUTLIER'));
}
