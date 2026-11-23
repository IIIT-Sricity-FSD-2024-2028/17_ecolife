export interface ExtractedBillData {
  detectedDomain: 'ELECTRICITY_THERMAL' | 'FUEL' | 'WATER' | 'UNKNOWN';
  quantity: number | null;
  unit: string | null;
  apparentKvahDetected: number | null;
  kvahBlockedWarning: boolean;
  costInr: number | null;
  invoiceNumber: string | null;
  consumerNumber: string | null;
  gstin: string | null;
  billingPeriodHint: string | null;
  confidencePct: number;
  rawTextPreview: string;
}

/**
 * Deterministic regex & heuristic parser for Indian utility bills (MSEDCL, BESCOM, Tata Power, Adani)
 * and fuel invoices (IOCL, BPCL, HPCL, Mahanagar Gas, IGL).
 */
export function parseIndianBillText(rawText: string): ExtractedBillData {
  const text = rawText.replace(/\r/g, '\n');
  let matches = 0;

  // 1. Active kWh vs Apparent kVAh detection
  const kwhMatch = text.match(/(?:total\s+)?(?:active\s+)?(?:energy|units|consumption|billed\s+units)?[\s:=-]*([\d,]+(?:\.\d+)?)\s*(kwh|mwh)\b/i);
  const kvahMatch = text.match(/([\d,]+(?:\.\d+)?)\s*kvah\b/i);
  const fuelMatch = text.match(/(?:hsd|diesel|petrol|lpg|png|cng|coal|biomass|furnace\s*oil|fuel)[^\n]{0,40}?([\d,]+(?:\.\d+)?)\s*(litres?|ltrs?|l|kg|mt|tonnes?|scm|m3)\b/i);
  const waterMatch = text.match(/(?:water|kl|kilolitres?)[^\n]{0,30}?([\d,]+(?:\.\d+)?)\s*(kl|m3|litres?)\b/i);

  let detectedDomain: ExtractedBillData['detectedDomain'] = 'UNKNOWN';
  let quantity: number | null = null;
  let unit: string | null = null;

  if (kwhMatch) {
    detectedDomain = 'ELECTRICITY_THERMAL';
    quantity = Number(kwhMatch[1].replace(/,/g, ''));
    unit = kwhMatch[2].toLowerCase() === 'mwh' ? 'MWh' : 'kWh';
    matches += 2;
  } else if (fuelMatch) {
    detectedDomain = 'FUEL';
    quantity = Number(fuelMatch[1].replace(/,/g, ''));
    const rawU = fuelMatch[2].toLowerCase();
    unit = rawU.startsWith('l') ? 'L' : rawU.startsWith('mt') || rawU.startsWith('ton') ? 'MT' : rawU.startsWith('scm') ? 'SCM' : 'kg';
    matches += 2;
  } else if (waterMatch) {
    detectedDomain = 'WATER';
    quantity = Number(waterMatch[1].replace(/,/g, ''));
    unit = 'kL';
    matches += 2;
  }

  const apparentKvahDetected = kvahMatch ? Number(kvahMatch[1].replace(/,/g, '')) : null;
  const kvahBlockedWarning = Boolean(apparentKvahDetected && !kwhMatch);

  // 2. Total Amount (INR)
  const amtMatch = text.match(/(?:total\s+(?:amount|payable|bill|due)|grand\s+total|net\s+payable|invoice\s+value)[\s:₹RsINR.-]*([\d,]+(?:\.\d{1,2})?)/i);
  const costInr = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : null;
  if (costInr) matches += 1;

  // 3. Invoice / Bill Number
  const invMatch = text.match(/(?:invoice\s*(?:no|number|#)|bill\s*(?:no|number|#)|voucher\s*no)[\s.:#-]*([A-Z0-9/-]{4,28})/i);
  const invoiceNumber = invMatch ? invMatch[1].trim() : null;
  if (invoiceNumber) matches += 1;

  // 4. DISCOM Consumer Number
  const consMatch = text.match(/(?:consumer\s*(?:no|number|id)|ca\s*no|account\s*id)[\s.:#-]*([A-Z0-9-]{6,20})/i);
  const consumerNumber = consMatch ? consMatch[1].trim() : null;
  if (consumerNumber) matches += 1;

  // 5. GSTIN
  const gstMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/);
  const gstin = gstMatch ? gstMatch[1] : null;
  if (gstin) matches += 1;

  // 6. Billing Period Hint
  const periodMatch = text.match(/(?:billing\s*period|bill\s*month|period)[\s:]*([A-Za-z0-9\s/-]{4,26})/i);
  const billingPeriodHint = periodMatch ? periodMatch[1].trim() : null;

  const confidencePct = Math.min(98, Math.max(15, Math.round((matches / 6) * 100)));

  return {
    detectedDomain,
    quantity,
    unit,
    apparentKvahDetected,
    kvahBlockedWarning,
    costInr,
    invoiceNumber,
    consumerNumber,
    gstin,
    billingPeriodHint,
    confidencePct,
    rawTextPreview: text.slice(0, 600).trim()
  };
}
