import { BadRequestException } from '@nestjs/common';

export type Dimension = 'volume' | 'mass' | 'energy' | 'money';

/**
 * Every unit the platform accepts, with its factor to the dimension's base unit
 * (volume → litre, mass → kg, energy → GJ, money → INR).
 * Nothing outside this table is ever silently treated as the factor's unit.
 */
const UNITS: Record<string, { dim: Dimension; toBase: number; label: string }> = {
  // volume (base: litre). Gas volumes are standard cubic metres (1 scm = 1 m³ = 1000 L).
  l: { dim: 'volume', toBase: 1, label: 'litre' },
  litre: { dim: 'volume', toBase: 1, label: 'litre' },
  litres: { dim: 'volume', toBase: 1, label: 'litre' },
  ltr: { dim: 'volume', toBase: 1, label: 'litre' },
  kl: { dim: 'volume', toBase: 1000, label: 'kilolitre' },
  m3: { dim: 'volume', toBase: 1000, label: 'cubic metre' },
  scm: { dim: 'volume', toBase: 1000, label: 'standard cubic metre' },
  nm3: { dim: 'volume', toBase: 1000, label: 'normal cubic metre' },
  gal_us: { dim: 'volume', toBase: 3.785411784, label: 'US gallon' },
  gal_uk: { dim: 'volume', toBase: 4.54609, label: 'imperial gallon' },
  // mass (base: kg)
  kg: { dim: 'mass', toBase: 1, label: 'kilogram' },
  g: { dim: 'mass', toBase: 0.001, label: 'gram' },
  t: { dim: 'mass', toBase: 1000, label: 'tonne' },
  tonne: { dim: 'mass', toBase: 1000, label: 'tonne' },
  tonnes: { dim: 'mass', toBase: 1000, label: 'tonne' },
  mt: { dim: 'mass', toBase: 1000, label: 'metric tonne' },
  // energy (base: GJ). 1 kWh = 3.6 MJ; 1 MMBtu = 1.055056 GJ; 1 kcal = 4.1868 kJ (IT).
  kwh: { dim: 'energy', toBase: 0.0036, label: 'kWh' },
  mwh: { dim: 'energy', toBase: 3.6, label: 'MWh' },
  gwh: { dim: 'energy', toBase: 3600, label: 'GWh' },
  mj: { dim: 'energy', toBase: 0.001, label: 'MJ' },
  gj: { dim: 'energy', toBase: 1, label: 'GJ' },
  tj: { dim: 'energy', toBase: 1000, label: 'TJ' },
  mmbtu: { dim: 'energy', toBase: 1.055056, label: 'MMBtu' },
  kcal: { dim: 'energy', toBase: 4.1868e-6, label: 'kcal' },
  // money (base: INR)
  inr: { dim: 'money', toBase: 1, label: '₹' },
  inr_1000: { dim: 'money', toBase: 1000, label: '₹ thousand' },
  inr_lakh: { dim: 'money', toBase: 100000, label: '₹ lakh' },
  inr_crore: { dim: 'money', toBase: 10000000, label: '₹ crore' }
};

const AMBIGUOUS: Record<string, string> = {
  gal: "'gal' is ambiguous (US 3.785 L vs imperial 4.546 L). Use 'gal_us' or 'gal_uk'.",
  gallon: "'gallon' is ambiguous (US 3.785 L vs imperial 4.546 L). Use 'gal_us' or 'gal_uk'.",
  gallons: "'gallons' is ambiguous (US 3.785 L vs imperial 4.546 L). Use 'gal_us' or 'gal_uk'.",
  ton: "'ton' is ambiguous (short, long or metric). Use 'tonne' for 1000 kg.",
  tons: "'tons' is ambiguous (short, long or metric). Use 'tonne' for 1000 kg.",
  kvah: 'kVAh (apparent energy) cannot be used for emissions. Enter active energy in kWh.',
  kva: 'kVA is a power rating, not energy. Enter active energy in kWh.',
  kw: 'kW is power, not energy. Enter energy in kWh (kW × hours).',
  hp: 'Horsepower is power, not energy. Enter fuel or energy consumed.'
};

export function normalizeUnitKey(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, '').replace('³', '3').replace('m^3', 'm3');
}

export function lookupUnit(unit: string) {
  const key = normalizeUnitKey(unit);
  if (AMBIGUOUS[key]) throw new BadRequestException(AMBIGUOUS[key]);
  const u = UNITS[key];
  if (!u) throw new BadRequestException(`Unknown unit '${unit}'. Supported: ${Object.keys(UNITS).filter((k) => !k.startsWith('inr_')).join(', ')}.`);
  return { ...u, key };
}

export interface ConversionContext {
  densityKgPerLitre?: number | null;
  /** NCV of the factor, MJ per canonical unit (needed for energy → fuel quantity). */
  ncvMjPerCanonical?: number | null;
  /** Multiplier applied to energy quantities given on a gross (GCV) basis to reach NCV. */
  gcvToNcv?: number;
}

export interface ConversionResult {
  quantity: number; // in the factor's canonical unit
  path: string; // human-readable audit trail
  gcvApplied: boolean;
}

/** IPCC/IEA convention: NCV ≈ 0.95 × GCV for solid & liquid fuels, 0.90 × GCV for natural gas. */
export function gcvToNcvMultiplier(canonicalUnitKey: string): number {
  const u = UNITS[canonicalUnitKey];
  return u && u.dim === 'volume' && ['scm', 'm3', 'nm3'].includes(canonicalUnitKey) ? 0.9 : 0.95;
}

export function convertToCanonical(qty: number, rawUnit: string, canonicalUnit: string, ctx: ConversionContext = {}): ConversionResult {
  const raw = lookupUnit(rawUnit);
  const canon = lookupUnit(canonicalUnit);
  const path: string[] = [`${qty} ${raw.key}`];

  if (raw.dim === canon.dim) {
    const out = (qty * raw.toBase) / canon.toBase;
    return { quantity: out, path: `${path[0]} → ${out} ${canon.key}`, gcvApplied: false };
  }

  // mass <-> volume through density
  if ((raw.dim === 'mass' && canon.dim === 'volume') || (raw.dim === 'volume' && canon.dim === 'mass')) {
    const d = ctx.densityKgPerLitre;
    if (!d || d <= 0) throw new BadRequestException(`Cannot convert ${raw.label} to ${canon.label}: this fuel has no density on record. Enter the quantity in ${canon.label}.`);
    const out = raw.dim === 'mass' ? ((qty * raw.toBase) / d) / canon.toBase : (qty * raw.toBase * d) / canon.toBase;
    return { quantity: out, path: `${path[0]} → ${out} ${canon.key} (density ${d} kg/L)`, gcvApplied: false };
  }

  // energy -> physical fuel quantity through calorific value
  if (raw.dim === 'energy' && (canon.dim === 'mass' || canon.dim === 'volume')) {
    const ncv = ctx.ncvMjPerCanonical;
    if (!ncv || ncv <= 0) throw new BadRequestException(`Cannot convert ${raw.label} to ${canon.label}: this fuel has no calorific value on record. Enter the quantity in ${canon.label}.`);
    const mult = ctx.gcvToNcv ?? 1;
    const gjNcv = qty * raw.toBase * mult;
    const out = (gjNcv * 1000) / ncv; // GJ → MJ ÷ (MJ per canonical unit)
    return { quantity: out, path: `${path[0]} → ${gjNcv} GJ (NCV${mult !== 1 ? `, ×${mult} from GCV` : ''}) → ${out} ${canon.key}`, gcvApplied: mult !== 1 };
  }

  throw new BadRequestException(`A quantity in ${raw.label} cannot be used for a factor measured in ${canon.label}.`);
}

export function describeUnitFamily(canonicalUnit: string): string {
  const c = lookupUnit(canonicalUnit);
  return Object.entries(UNITS)
    .filter(([k, v]) => v.dim === c.dim && !k.startsWith('inr_') && !['litre', 'litres', 'ltr', 'tonne', 'tonnes'].includes(k))
    .map(([k]) => k)
    .join(', ');
}

/** The units the platform accepts, once each, for choice lists on screen. `aliases` are the other spellings it also accepts ("ltr", "litres"), so a screen can recognise a stored value. */
export function listUnits(): { key: string; label: string; dimension: Dimension; aliases: string[] }[] {
  const out: { key: string; label: string; dimension: Dimension; aliases: string[] }[] = [];
  const byId = new Map<string, (typeof out)[number]>();
  for (const [key, u] of Object.entries(UNITS)) {
    const id = `${u.dim}|${u.label}`;
    const seen = byId.get(id);
    if (seen) { seen.aliases.push(key); continue; }
    const row = { key, label: u.label, dimension: u.dim, aliases: [key] };
    byId.set(id, row);
    out.push(row);
  }
  return out;
}
