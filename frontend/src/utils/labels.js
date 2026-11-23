/* Everyday wording for stored codes. The codes themselves come from the backend; this only decides how they read on screen. */
export const WATER_SOURCE = { SURFACE: 'River, lake or canal', GROUNDWATER: 'Borewell or groundwater', THIRD_PARTY: 'Municipal or tanker supply', SEAWATER_DESALINATED: 'Seawater (desalinated)', OTHERS: 'Another source' };
export const WATER_DEST = { SURFACE: 'River, lake or canal', GROUNDWATER: 'Soaked into the ground', SEAWATER: 'Sea', THIRD_PARTY: 'Sent to another party or common treatment plant', OTHERS: 'Somewhere else', ZLD_RECYCLED: 'Nothing discharged (zero liquid discharge)' };
export const TREATMENT = { NONE: 'Not treated', PRIMARY: 'Basic (primary)', SECONDARY: 'Biological (secondary)', TERTIARY: 'Advanced (tertiary)' };
export const WASTE_CATEGORY = { PLASTIC: 'Plastic', E_WASTE: 'Electronic waste', BIO_MEDICAL: 'Bio-medical waste', CONSTRUCTION_DEMOLITION: 'Construction and demolition', BATTERY: 'Batteries', RADIOACTIVE: 'Radioactive waste', OTHER_HAZARDOUS: 'Other hazardous waste', OTHER_NON_HAZARDOUS: 'Other non-hazardous waste' };
export const WASTE_ROUTE = { RECYCLED: 'Recycled', REUSED: 'Reused', OTHER_RECOVERY: 'Other recovery', INCINERATED_WITH_ENERGY: 'Burned, energy recovered', INCINERATED_WITHOUT_ENERGY: 'Burned, no energy recovered', LANDFILLED: 'Landfill', OTHER_SAFE_DISPOSAL: 'Other safe disposal' };

/** Plain-language reading of the automatic check flags attached to a record. */
export function describeFlag(code) {
  const c = String(code || '');
  let m;
  if ((m = c.match(/^ANOMALY_HIGH_SPIKE_\+?(\d+)PCT$/))) return `${m[1]}% higher than usual`;
  if ((m = c.match(/^ANOMALY_LOW_DROP_-?(\d+)PCT$/))) return `${m[1]}% lower than usual`;
  if ((m = c.match(/^UNIT_COST_OUTLIER_([+-])(\d+)PCT$/))) return `Price per unit is ${m[2]}% ${m[1] === '+' ? 'above' : 'below'} your average`;
  if ((m = c.match(/^TANK_VARIANCE_([\d.]+)PCT$/))) return `Tank readings do not add up (${m[1]}% off)`;
  if ((m = c.match(/^FLOOR_AREA_SHARE_([\d.]+)PCT$/))) return `Only ${m[1]}% of the bill counted (shared floor area)`;
  if ((m = c.match(/^LAB_NCV_DEVIATES_(\d+)PCT/))) return `Lab heating value differs ${m[1]}% from the standard. Check the certificate`;
  const map = {
    OUTLIER_GT_2_5X: 'More than 2.5 times the usual amount',
    NET_METERING_GROSS_IMPORT_USED: 'Counted the gross grid import (net metering)',
    NON_ENERGY_USE_DEDUCTED: 'Fuel used as material was taken out',
    GCV_CONVERTED_TO_NCV: 'Heating value converted to the standard basis',
    LAB_NCV_OVERRIDE: 'Uses the lab-tested heating value',
    INGESTED_VIA_API: 'Sent in by a software connection',
    DUPLICATE_INVOICE: 'This bill number was already entered',
    BILLING_PERIOD_MISSING: 'Bill dates are missing'
  };
  return map[c] || c.toLowerCase().replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase());
}
/** Only these need a person's attention; the rest are informational. */
export const isAnomaly = (code) => /^(ANOMALY_|UNIT_COST_OUTLIER|OUTLIER_)/.test(String(code));

export const TARGET_FRAMEWORK = { CUSTOM_INTERNAL: 'Our own target', SBTI_SME_ROUTE: 'SBTi, small company route', SBTI_NEAR_TERM: 'SBTi, near term', SBTI_NET_ZERO: 'SBTi, net zero', BEE_CCTS_GEI: 'BEE carbon market intensity' };
export const TARGET_COVERAGE = { SCOPE_1: 'Scope 1 only', SCOPE_2_LOCATION: 'Scope 2, grid average', SCOPE_2_MARKET: 'Scope 2, after green power', SCOPE_1_AND_2_LOCATION: 'Scope 1 and 2, grid average', SCOPE_1_AND_2_MARKET: 'Scope 1 and 2, after green power', SCOPE_3: 'Scope 3 only', ALL_SCOPES_1_2_3: 'All scopes' };
export const TARGET_TYPE = { ABSOLUTE: 'Total emissions', INTENSITY: 'Emissions per unit produced' };
export const LEVER = { ONSITE_SOLAR: 'Solar on the roof', FUEL_SWITCH: 'Switch fuel', ENERGY_EFFICIENCY: 'Use less energy', PPA_OPEN_ACCESS: 'Buy green power (open access)', REFRIGERANT_SWAP: 'Change cooling gas', FLEET_ELECTRIFICATION: 'Electric vehicles' };
export const ACTION_STATUS = { PLANNED: 'Planned', IN_PROGRESS: 'In progress', DELAYED: 'Delayed', COMPLETED: 'Done', PARTIALLY_ACHIEVED: 'Partly achieved', CANCELLED: 'Cancelled' };
export const TARGET_STATUS = { ON_TRACK: 'On track', BEHIND: 'Behind', AT_RISK: 'At risk', ACHIEVED: 'Achieved', NOT_STARTED: 'Not started', ACTIVE: 'Active' };

export const SCOPE3_CATEGORY = { 1: 'Purchased goods and services', 2: 'Capital goods', 3: 'Fuel and energy not in Scope 1 or 2', 4: 'Transport and distribution into your site', 5: 'Waste from your operations', 6: 'Business travel', 7: 'Staff commuting', 8: 'Leased assets you rent', 9: 'Transport and distribution after you sell', 10: 'Processing of your sold products', 11: 'Use of your sold products', 12: 'End of life of your sold products', 13: 'Leased assets you rent out', 14: 'Franchises', 15: 'Investments' };
export const SCOPE3_METHOD = { SUPPLIER_PCF: 'Supplier’s own figure', HYBRID: 'Mix of supplier and average data', AVERAGE_DATA: 'Average data for the product', SPEND_BASED: 'Based on money spent' };
export const ENTRY_STATUS = { DRAFT: 'Draft', SUBMITTED: 'Waiting for review', APPROVED: 'Approved', REJECTED: 'Sent back', WITHDRAWN: 'Withdrawn' };

export const CREDIT_CLASS = { BEE_CCTS_ICC: 'Carbon market certificate (BEE)', VOLUNTARY_CARBON_CREDIT: 'Voluntary carbon credit', MOEFCC_GREEN_CREDIT: 'Government green credit (tree planting)' };
export const CREDIT_STATUS = { ISSUED: 'Issued to us', PROCURED: 'Bought', PENDING_RETIREMENT: 'Retirement requested', RETIRED: 'Used up', EXTINGUISHED: 'Cancelled', TRANSFERRED_SUBSIDIARY: 'Moved to another company' };

export const RECALC_TRIGGER = { STRUCTURAL_ACQUISITION: 'We bought a business or site', STRUCTURAL_DIVESTMENT: 'We sold a business or site', OUTSOURCING_INSOURCING: 'We moved work in-house or outside', METHODOLOGY_CHANGE: 'We changed how we calculate', FACTOR_TRUE_UP: 'A factor was updated', ERROR_CORRECTION: 'We found a mistake', BOUNDARY_CHANGE: 'The reporting boundary changed' };
export const PERIOD_STATUS = { OPEN: 'Open', PENDING_REVIEW: 'In review', CLOSED: 'Closed', SIGNED_OFF: 'Signed off', REOPENED: 'Reopened' };

export const ROLE = { ORG_ADMIN: 'Company admin', PLANT_MANAGER: 'Plant manager', FINANCE_MANAGER: 'Finance', SUSTAINABILITY_LEAD: 'Sustainability lead', INTERNAL_AUDITOR: 'Internal auditor', EXECUTIVE_APPROVER: 'Executive', EXTERNAL_VERIFIER: 'External verifier' };
export const ROLE_HELP = { ORG_ADMIN: 'Manages people, settings and billing', PLANT_MANAGER: 'Records data for the sites they are given', FINANCE_MANAGER: 'Financial figures, imports and invoices', SUSTAINABILITY_LEAD: 'Reviews data, closes months, runs reports', INTERNAL_AUDITOR: 'Reads everything, changes nothing', EXECUTIVE_APPROVER: 'Signs off years and decides corrections', EXTERNAL_VERIFIER: 'Outside auditor with read-only access' };
export const MODULE = { FUELS: 'Fuels', ELECTRICITY: 'Electricity', WATER: 'Water', WASTE: 'Waste', REFRIGERANTS: 'Cooling gases', AIR: 'Air emissions', MATERIALS: 'Raw materials', VALUE_CHAIN: 'Suppliers and supply chain', GREEN_ECONOMY: 'Carbon credits', TARGETS: 'Targets and projects', ASSURANCE: 'Audit and verification' };
export const ASSURANCE = { INTERNAL_TRACKING: 'Internal tracking only', SEBI_ISF_ASSESSMENT: 'SEBI assessment', ICAI_SSAE_3000: 'ICAI SSAE 3000', ICAI_SSAE_3410: 'ICAI SSAE 3410', ISO_14064_3: 'ISO 14064-3', ISSA_5000: 'ISSA 5000', BEE_CCTS_ACVA: 'BEE carbon market verifier' };

export const FINDING_SEVERITY = { CLARIFICATION: 'Question', MATERIAL_MISSTATEMENT: 'Figure is materially wrong', NONCONFORMITY: 'Process does not meet the standard' };
export const FINDING_STATUS = { OPEN: 'Waiting for the company', RESPONDED: 'Answered, waiting for the verifier', RESOLVED: 'Resolved', UNRESOLVED: 'Not resolved' };
export const OPINION = { UNMODIFIED: 'Clean opinion', QUALIFIED: 'Qualified opinion', ADVERSE: 'Adverse opinion', DISCLAIMER: 'No opinion given' };
export const ENGAGEMENT_STATUS = { IN_PROGRESS: 'In progress', OPINION_ISSUED: 'Opinion issued' };
export const AUDIT_STATUS = { PASS: 'Control works', DEFICIENCY: 'Gap found', REMEDIATION_REQUIRED: 'Fix required', CLOSED: 'Closed' };

/** Find a unit from the list the server sends, whatever spelling was stored ("litres", "ltr", "L", "litre"). */
export const findUnit = (units = [], raw) => {
  const k = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  return units.find((u) => u.key === k || (u.aliases || []).includes(k) || u.label.toLowerCase().replace(/\s+/g, '') === k);
};
