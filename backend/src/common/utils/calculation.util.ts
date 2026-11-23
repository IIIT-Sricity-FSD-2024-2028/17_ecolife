import { BadRequestException } from '@nestjs/common';
import { CalorificBasis, Prisma } from '../../generated/prisma';
import { convertToCanonical, gcvToNcvMultiplier, lookupUnit } from './units';

export interface CalculationInput {
  factorId: string;
  rawQuantity: number;
  rawUnit: string;
  domain: string;
  calorificBasis?: CalorificBasis;
  openingStockQty?: number | null;
  purchasedQty?: number | null;
  closingStockQty?: number | null;
  /** Quantity (raw unit) used as feedstock/non-combustion and therefore deducted from combustion emissions. */
  nonEnergyDeductedQty?: number | null;
  /** Lab-certified overrides (MJ per canonical unit / kg per litre). */
  labNcvOverride?: number | null;
  labDensityOverride?: number | null;
  /** Floor-area share (0..1) when only part of a shared building is the reporting entity's. */
  shareFraction?: number | null;
  /** Net-metering split bill: kWh imported from the grid and solar consumed on site. */
  grossGridImportKwh?: number | null;
  onsiteSolarSelfConsumedKwh?: number | null;
  /** The period the entry belongs to; used to verify the factor is valid for it. */
  periodStart?: Date;
  periodEnd?: Date;
}

export interface CalculationResult {
  normalizedQuantity: number;
  normalizedUnit: string;
  calculatedEnergyGj: number;
  calculatedCo2Kg: number;
  calculatedBiogenicCo2Kg: number;
  calculatedCh4Kg: number;
  calculatedN2oKg: number;
  calculatedTco2eAr6: number;
  calculatedTco2eAr2: number;
  appliedFloorAreaSharePct: number | null;
  pinnedFactorSnapshot: Prisma.InputJsonValue;
  qualityFlags: string[];
}

const USABLE_STATUS = ['PUBLISHED', 'APPROVED'];
const fail = (msg: string): never => {
  throw new BadRequestException(msg);
};

/**
 * Checks a factor may be used for a source/period. Used by create, edit and ingest so every route enforces the same rules.
 * - status: only PUBLISHED global factors or APPROVED organisation factors
 * - validity: the factor's validity window must cover the whole reporting period
 * - regime: BEE CCTS baseline factors are for CCTS filings, not ordinary reporting
 * - match: factor domain and scope must equal the source's
 */
export function assertFactorUsable(
  factor: { code: string; status: string; validFrom: Date; validTo: Date | null; regimeTag: string; domain: string; scope: string; organizationId: string | null },
  source: { domain: string; scope: string },
  period?: { startDate: Date; endDate: Date; label?: string }
) {
  if (!USABLE_STATUS.includes(factor.status)) {
    fail(`Factor ${factor.code} is ${factor.status.replace('_', ' ').toLowerCase()} and cannot be used for new entries.`);
  }
  if (factor.regimeTag === 'BEE_CCTS') fail(`Factor ${factor.code} is a BEE CCTS baseline factor. Use the general reporting factor for entries; CCTS filings apply it automatically.`);
  if (factor.domain !== source.domain) fail(`Factor ${factor.code} is for ${factor.domain.toLowerCase().replace('_', ' ')} but this source records ${source.domain.toLowerCase().replace('_', ' ')}.`);
  if (factor.scope !== source.scope) fail(`Factor ${factor.code} is a ${factor.scope.replace('_', ' ').toLowerCase()} factor but this source is ${source.scope.replace('_', ' ').toLowerCase()}.`);
  if (period) {
    if (factor.validFrom > period.startDate) fail(`Factor ${factor.code} is valid from ${factor.validFrom.toISOString().slice(0, 10)}, after ${period.label ?? 'this period'} starts.`);
    if (factor.validTo && factor.validTo < period.endDate) fail(`Factor ${factor.code} expired on ${factor.validTo.toISOString().slice(0, 10)}, before ${period.label ?? 'this period'} ends. Choose the factor for this year.`);
  }
}

/**
 * Server-side, database-driven GHG & energy calculation.
 * Emissions come from the factor's physical per-unit values (never from the calorific basis);
 * the calorific basis only converts energy-denominated inputs (GJ, MWh, MMBtu…) to fuel quantity.
 */
export async function calculateResourceEntry(tx: Prisma.TransactionClient, input: CalculationInput): Promise<CalculationResult> {
  const qualityFlags: string[] = [];
  if (!Number.isFinite(input.rawQuantity) || input.rawQuantity < 0) fail('Quantity must be zero or a positive number.');

  const factor = await tx.emissionFactor.findUnique({ where: { id: input.factorId } });
  if (!factor) return fail('Emission factor not found.');
  const canon = lookupUnit(factor.canonicalUnit);
  const rawUnitInfo = lookupUnit(input.rawUnit); // rejects kVAh, 'gal', unknown units
  const isElectricity = input.domain === 'ELECTRICITY_THERMAL';

  // Net-metering split bill: emissions follow the grid import, not the net-billed figure.
  let quantity = input.rawQuantity;
  let rawUnit = input.rawUnit;
  if (isElectricity && input.grossGridImportKwh != null) {
    if (input.grossGridImportKwh < 0) fail('Gross grid import cannot be negative.');
    quantity = input.grossGridImportKwh;
    rawUnit = 'kWh';
    qualityFlags.push('NET_METERING_GROSS_IMPORT_USED');
  }

  // Tank stock reconciliation: opening + purchased − closing must explain what was burnt.
  if (input.openingStockQty != null && input.purchasedQty != null && input.closingStockQty != null) {
    const derived = input.openingStockQty + input.purchasedQty - input.closingStockQty;
    if (derived < 0) fail('Tank stock reconciliation: opening + purchased − closing cannot be negative. Check the closing stock reading.');
    const variancePct = derived > 0 ? (Math.abs(quantity - derived) / derived) * 100 : 0;
    if (variancePct > 2) qualityFlags.push(`TANK_VARIANCE_${variancePct.toFixed(1)}PCT`);
    if (quantity === 0 && derived > 0) quantity = derived;
  }

  if (input.nonEnergyDeductedQty != null && input.nonEnergyDeductedQty > 0) {
    if (input.nonEnergyDeductedQty > quantity) fail('Non-energy (feedstock) quantity cannot exceed the total quantity.');
    quantity -= input.nonEnergyDeductedQty;
    qualityFlags.push('NON_ENERGY_USE_DEDUCTED');
  }

  let appliedShare: number | null = null;
  if (input.shareFraction != null && input.shareFraction < 1) {
    if (input.shareFraction <= 0) fail('Floor-area share must be greater than zero.');
    quantity *= input.shareFraction;
    appliedShare = Number((input.shareFraction * 100).toFixed(2));
    qualityFlags.push(`FLOOR_AREA_SHARE_${appliedShare}PCT`);
  }

  const factorNcv = factor.ncvMjPerUnit ? Number(factor.ncvMjPerUnit) : null;
  const labNcv = input.labNcvOverride ?? null;
  const density = input.labDensityOverride ?? (factor.densityKgPerLitre ? Number(factor.densityKgPerLitre) : null);
  const basisIsGcv = input.calorificBasis === 'GCV_CONVERTED';
  const energyGivenAsEnergy = rawUnitInfo.dim === 'energy' && canon.dim !== 'energy' && !(isElectricity && input.grossGridImportKwh != null);
  const gcvMult = basisIsGcv && energyGivenAsEnergy ? gcvToNcvMultiplier(canon.key) : 1;
  if (basisIsGcv && !energyGivenAsEnergy) qualityFlags.push('CALORIFIC_BASIS_NOT_APPLICABLE_TO_THIS_UNIT');
  if (gcvMult !== 1) qualityFlags.push('GCV_CONVERTED_TO_NCV');

  const conv = convertToCanonical(quantity, rawUnit, factor.canonicalUnit, {
    densityKgPerLitre: density,
    ncvMjPerCanonical: labNcv ?? factorNcv,
    gcvToNcv: gcvMult
  });
  const normalizedQty = conv.quantity;

  // GWP rows: no silent fallbacks — a missing row is a data problem to fix, not to guess.
  const gwpRows = await tx.gwpTable.findMany();
  const gwpByCode = new Map(gwpRows.map((g) => [g.gasCode, g]));
  const need = (code: string) => gwpByCode.get(code) ?? (fail(`GWP table is missing '${code}'. Ask the platform administrator to load it.`) as never);
  const ch4Row = need(factor.isBiogenic ? 'CH4_NON_FOSSIL' : 'CH4_FOSSIL');
  const n2oRow = need('N2O');
  const ch4Ar6 = Number(ch4Row.gwpAr6);
  const ch4Ar2 = Number(ch4Row.gwpAr2);
  const n2oAr6 = Number(n2oRow.gwpAr6);
  const n2oAr2 = Number(n2oRow.gwpAr2);

  // A lab NCV scales emissions: carbon content per unit of energy stays constant (IPCC Tier 2/3 practice).
  let labScale = 1;
  if (labNcv != null) {
    if (!(labNcv > 0)) fail('Lab NCV must be positive.');
    if (factorNcv) {
      labScale = labNcv / factorNcv;
      const dev = Math.abs(labScale - 1) * 100;
      qualityFlags.push(dev > 25 ? `LAB_NCV_DEVIATES_${dev.toFixed(0)}PCT_CHECK_CERTIFICATE` : 'LAB_NCV_OVERRIDE');
    } else {
      qualityFlags.push('LAB_NCV_IGNORED_NO_FACTOR_NCV');
    }
  }

  let co2Kg = normalizedQty * Number(factor.co2KgPerUnit) * labScale;
  const bioCo2Kg = normalizedQty * Number(factor.biogenicCo2KgPerUnit) * labScale;
  const ch4Kg = normalizedQty * Number(factor.ch4KgPerUnit) * labScale;
  const n2oKg = normalizedQty * Number(factor.n2oKgPerUnit) * labScale;

  let tco2eAr6 = (co2Kg + ch4Kg * ch4Ar6 + n2oKg * n2oAr6) / 1000;
  let tco2eAr2 = (co2Kg + ch4Kg * ch4Ar2 + n2oKg * n2oAr2) / 1000;
  let refrigerantGas: { code: string; ar6: number; ar2: number } | null = null;

  if (input.domain === 'REFRIGERANT') {
    if (canon.dim !== 'mass') fail('Refrigerant factors must be measured in kilograms.');
    if (!factor.hfcGasCode) fail(`Refrigerant factor ${factor.code} has no gas code, so its GWP cannot be applied.`);
    const gas = need(factor.hfcGasCode!);
    refrigerantGas = { code: gas.gasCode, ar6: Number(gas.gwpAr6), ar2: Number(gas.gwpAr2) };
    co2Kg = 0; // F-gases are reported as CO2e, not as CO2
    tco2eAr6 = (normalizedQty * refrigerantGas.ar6) / 1000;
    tco2eAr2 = (normalizedQty * refrigerantGas.ar2) / 1000;
  }

  // Energy (GJ)
  let energyGj = 0;
  if (canon.dim === 'energy') {
    energyGj = normalizedQty * canon.toBase;
    if (isElectricity && input.onsiteSolarSelfConsumedKwh != null && input.onsiteSolarSelfConsumedKwh > 0) {
      energyGj += input.onsiteSolarSelfConsumedKwh * 0.0036; // self-generated electricity is consumed energy, counted once
      qualityFlags.push('ONSITE_SOLAR_INCLUDED_IN_ENERGY');
    }
  } else if (labNcv ?? factorNcv) {
    const factorBasisMult = factor.calorificBasis === 'GCV_CONVERTED' && labNcv == null ? gcvToNcvMultiplier(canon.key) : 1;
    energyGj = (normalizedQty * (labNcv ?? factorNcv!) * factorBasisMult) / 1000;
    if (factorBasisMult !== 1) qualityFlags.push('FACTOR_CALORIFIC_VALUE_CONVERTED_GCV_TO_NCV');
  }

  const r = (n: number, d: number) => Number(n.toFixed(d));
  return {
    normalizedQuantity: r(normalizedQty, 6),
    normalizedUnit: factor.canonicalUnit,
    calculatedEnergyGj: r(energyGj, 6),
    calculatedCo2Kg: r(co2Kg, 6),
    calculatedBiogenicCo2Kg: r(bioCo2Kg, 6),
    calculatedCh4Kg: r(ch4Kg, 6),
    calculatedN2oKg: r(n2oKg, 6),
    calculatedTco2eAr6: r(tco2eAr6, 6),
    calculatedTco2eAr2: r(tco2eAr2, 6),
    appliedFloorAreaSharePct: appliedShare,
    qualityFlags,
    pinnedFactorSnapshot: {
      factorId: factor.id,
      code: factor.code,
      name: factor.name,
      sourceAuthority: factor.sourceAuthority,
      versionLabel: factor.versionLabel,
      tier: factor.tier,
      regimeTag: factor.regimeTag,
      validFrom: factor.validFrom.toISOString(),
      validTo: factor.validTo ? factor.validTo.toISOString() : null,
      canonicalUnit: factor.canonicalUnit,
      co2KgPerUnit: Number(factor.co2KgPerUnit),
      ch4KgPerUnit: Number(factor.ch4KgPerUnit),
      n2oKgPerUnit: Number(factor.n2oKgPerUnit),
      biogenicCo2KgPerUnit: Number(factor.biogenicCo2KgPerUnit),
      ncvMjPerUnit: factorNcv,
      densityKgPerLitre: density,
      conversion: conv.path,
      gwpUsed: { ch4Ar6, n2oAr6, ch4Ar2, n2oAr2, refrigerant: refrigerantGas }
    }
  };
}
