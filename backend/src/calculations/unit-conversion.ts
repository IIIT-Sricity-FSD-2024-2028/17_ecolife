/**
 * Scientific unit conversion engine aligned with the GHG Protocol
 * and standard engineering coefficients (NIST / EPA / DEFRA).
 */

const normalizeUnit = (u: string): string => {
  const s = (u || '').trim().toLowerCase();
  switch (s) {
    case 'l':
    case 'liter':
    case 'liters':
    case 'litre':
    case 'litres':
      return 'liters';
    case 'gal':
    case 'gallon':
    case 'gallons':
      return 'gallons';
    case 'm3':
    case 'm³':
    case 'cubic_meter':
    case 'cubic_meters':
      return 'm3';
    case 'kwh':
    case 'kilowatt_hour':
    case 'kilowatt_hours':
      return 'kwh';
    case 'mwh':
    case 'megawatt_hour':
    case 'megawatt_hours':
      return 'mwh';
    case 'gwh':
      return 'gwh';
    case 'therm':
    case 'therms':
    case 'thm':
      return 'therms';
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return 'kg';
    case 't':
    case 'tonne':
    case 'tonnes':
    case 'metric_ton':
    case 'metric_tons':
    case 'metric_tonne':
      return 'tonnes';
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      return 'lbs';
    case 'mj':
    case 'megajoule':
    case 'megajoules':
      return 'mj';
    case 'gj':
    case 'gigajoule':
    case 'gigajoules':
      return 'gj';
    default:
      return s;
  }
};

/** Conversion multipliers to base dimension units:
 * Base volume: liters
 * Base mass: kg
 * Base energy: kWh
 */
const VOLUME_TO_LITERS: Record<string, number> = {
  liters: 1,
  gallons: 3.785411784,
  m3: 1000,
};

const MASS_TO_KG: Record<string, number> = {
  kg: 1,
  tonnes: 1000,
  lbs: 0.45359237,
};

const ENERGY_TO_KWH: Record<string, number> = {
  kwh: 1,
  mwh: 1000,
  gwh: 1000000,
  therms: 29.3001,
  mj: 1 / 3.6,
  gj: 1000 / 3.6,
};

/** Natural gas volume to energy equivalency (standard EPA reference: 1 m³ natural gas ≈ 0.35315 therms ≈ 10.35 kWh) */
const GAS_M3_TO_KWH = 10.35;

/**
 * Converts a quantity from one unit of measurement to another.
 * Returns the normalized numeric quantity.
 */
export function convertQuantity(quantity: number, fromUnitRaw: string, toUnitRaw: string): number {
  if (typeof quantity !== 'number' || isNaN(quantity)) return 0;
  const from = normalizeUnit(fromUnitRaw);
  const to = normalizeUnit(toUnitRaw);

  if (from === to) return quantity;

  // 1. Volume conversions
  if (VOLUME_TO_LITERS[from] !== undefined && VOLUME_TO_LITERS[to] !== undefined) {
    const inLiters = quantity * VOLUME_TO_LITERS[from];
    return inLiters / VOLUME_TO_LITERS[to];
  }

  // 2. Mass conversions
  if (MASS_TO_KG[from] !== undefined && MASS_TO_KG[to] !== undefined) {
    const inKg = quantity * MASS_TO_KG[from];
    return inKg / MASS_TO_KG[to];
  }

  // 3. Energy conversions
  if (ENERGY_TO_KWH[from] !== undefined && ENERGY_TO_KWH[to] !== undefined) {
    const inKwh = quantity * ENERGY_TO_KWH[from];
    return inKwh / ENERGY_TO_KWH[to];
  }

  // 4. Natural gas cross-domain: m3 <-> therms
  if (from === 'm3' && to === 'therms') {
    return quantity * 0.35315;
  }
  if (from === 'therms' && to === 'm3') {
    return quantity / 0.35315;
  }

  // Fallback: If units are incompatible or unrecognized, return quantity unchanged
  return quantity;
}
