/**
 * Demo data for presentations and evaluation.
 *
 * Run AFTER `npm run db:seed`, with the API running:   npm run db:seed-demo
 *
 * It does not write rows by hand. It uses the product itself, signing in as each real role, so every
 * record has gone through the same rules, approvals, history and audit trail a real user would create.
 * It then walks the data into every state the screens can show: drafts, items waiting for review,
 * approved, rejected with a note, withdrawn, overdue, flagged, expired, and so on.
 *
 * Safe to run once. It refuses to run twice (it looks for the supplier 'Shree Steel Traders').
 * Settings: API_URL (default http://localhost:4000/api), SEED_DATABASE_URL / MIGRATE_DATABASE_URL.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const API = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const PW = process.env.DEMO_PASSWORD || 'Tropos@2026';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_DATABASE_URL || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL }) });

const tokens: Record<string, string> = {};
let ok = 0;
const failures: string[] = [];

async function login(email: string, password = PW) {
  if (tokens[email]) return tokens[email];
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const b: any = await r.json().catch(() => ({}));
  if (!r.ok || !b.token) throw new Error(`Cannot sign in as ${email}: ${r.status} ${JSON.stringify(b).slice(0, 200)}`);
  return (tokens[email] = b.token);
}
const U: Record<string, string> = { lead: 'lead@bharatgears.in', plant: 'plant@bharatgears.in', admin: 'admin@bharatgears.in', fin: 'finance@bharatgears.in', exec: 'exec@bharatgears.in', aud: 'auditor@bharatgears.in', ver: 'verifier@acva-india.in', plat: 'platform.admin@tropos.in' };

async function call(who: string, method: string, path: string, body?: unknown, okCodes: number[] = [200, 201]) {
  const t = await login(who);
  const r = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${t}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let j: any; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { _text: txt.slice(0, 200) }; }
  if (!okCodes.includes(r.status)) throw new Error(`${method} ${path} as ${who.split('@')[0]} -> ${r.status} ${JSON.stringify(j).slice(0, 260)}`);
  return j;
}
const get = (who: string, path: string) => call(who, 'GET', path);
const post = (who: string, path: string, body?: unknown) => call(who, 'POST', path, body ?? {});
const patch = (who: string, path: string, body?: unknown) => call(who, 'PATCH', path, body ?? {});
const del = (who: string, path: string) => call(who, 'DELETE', path);
const rows = (j: any) => (Array.isArray(j) ? j : j.items ?? j.rows ?? []);

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try { const v = await fn(); ok++; console.log(`  ok   ${name}`); return v; }
  catch (e: any) { failures.push(`${name}: ${e.message}`); console.log(`  FAIL ${name}: ${e.message}`); return undefined; }
}

// A tiny valid PDF, used as a stand-in for a scanned bill or certificate.
const pdf = (title: string) => Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 100]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 12 Tf 10 50 Td (${title.replace(/[()\\]/g, '')}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
async function upload(who: string, fileName: string, title: string, entryId?: string) {
  const fd = new FormData();
  if (entryId) fd.append('entryId', entryId);
  fd.append('file', new Blob([pdf(title)], { type: 'application/pdf' }), fileName);
  const r = await fetch(`${API}/evidence/upload`, { method: 'POST', headers: { authorization: `Bearer ${await login(who)}` }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`upload ${fileName} -> ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return (j.evidence ?? j).id as string;
}
async function csv(who: string, periodId: string, text: string, commit: boolean, channel = 'CSV_EXCEL', name = 'import.csv') {
  const fd = new FormData();
  fd.append('file', new Blob([text], { type: 'text/csv' }), name);
  fd.append('periodId', periodId); fd.append('commit', String(commit)); fd.append('channel', channel);
  const r = await fetch(`${API}/imports/csv`, { method: 'POST', headers: { authorization: `Bearer ${await login(who)}` }, body: fd });
  const j: any = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}
const sqlAsOwner = async (fn: (tx: any) => Promise<void>) => prisma.$transaction(async (tx: any) => { await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`; await fn(tx); });

async function main() {
  console.log(`Demo data -> ${API}`);
  const health = await fetch(`${API}/auth/me`).catch(() => null);
  if (!health) throw new Error(`The API is not reachable at ${API}. Start it first (npm run start).`);

  const org = await prisma.organization.findFirstOrThrow({ where: { name: 'Bharat Precision Gears Pvt. Ltd.' } });
  if (await prisma.supplier.findFirst({ where: { organizationId: org.id, name: 'Shree Steel Traders' } }).catch(() => null)) { console.log('Demo data already present. Nothing to do.'); return; }

  // Settings that unlock every module for the demonstration company.
  await step('Company settings: all modules on, CCTS obligated', () => patch(U.lead, '/org/settings', { preset: 'ENTERPRISE_BRSR', cctsObligated: true, assuranceStandard: 'ISO_14064_3' }));

  const periods = rows(await get(U.lead, '/periods'));
  const APR = periods.find((p: any) => p.label === 'Apr 2026');
  const FEB = periods.find((p: any) => p.label === 'Feb 2026');
  const MAR = periods.find((p: any) => p.label === 'Mar 2026');
  if (!APR || !FEB || !MAR) throw new Error('Run `npm run db:seed` first (the base periods are missing).');
  // May 2026 is the live working month where every in-progress state lives; April is closed cleanly below.
  const P = (await call(U.lead, 'POST', '/periods', { year: 2026, month: 5 })) as any;
  const facilities = rows(await get(U.lead, '/facilities'));
  const pune = facilities[0];
  const entities = rows(await get(U.lead, '/entities'));
  const parent = entities[0];
  const sources = rows(await get(U.lead, '/sources'));
  const src = (s: string) => sources.find((x: any) => x.name.startsWith(s));
  const factors = rows(await get(U.lead, '/factors'));
  const fac = (code: string) => factors.find((f: any) => f.code === code);

  // ───────────────────────────── 1. Organisation structure (Admin, Lead, Executive)
  console.log('\n1. Structure and people');
  const sub = await step('Subsidiary (approved)', async () => { const e = await post(U.lead, '/entities', { name: 'Bharat Gears Components Pvt. Ltd.', cin: 'U29100MH2019PTC331822', parentEntityId: parent.id, ownershipPct: 100 }); await patch(U.exec, `/entities/${e.id}/approve`, { status: 'APPROVED' }); return e; });
  await step('Joint venture (waiting for approval)', () => post(U.lead, '/entities', { name: 'Gears & Drives JV (51%)', cin: 'U29100MH2022PTC389104', parentEntityId: parent.id, ownershipPct: 51, hasOperationalControl: false }));
  await step('Rejected entity', async () => { const e = await post(U.lead, '/entities', { name: 'Old Tooling Division', ownershipPct: 100 }); await patch(U.exec, `/entities/${e.id}/approve`, { status: 'REJECTED' }); });
  const nashik = await step('Nashik warehouse (approved)', async () => { const f = await post(U.lead, '/facilities', { entityId: sub?.id ?? parent.id, name: 'Nashik Warehouse', facilityType: 'WAREHOUSE', city: 'Nashik', state: 'Maharashtra', meteringMode: 'NET_METERING', rooftopSolarKwp: 30, effectiveFrom: '2026-04-01' }); await patch(U.exec, `/facilities/${f.id}/approve`, { status: 'APPROVED' }); return f; });
  await step('Chennai sales office (waiting for approval)', () => post(U.lead, '/facilities', { entityId: parent.id, name: 'Chennai Sales Office', facilityType: 'OFFICE', city: 'Chennai', state: 'Tamil Nadu', isSharedBuilding: true, floorAreaSharePct: 18, effectiveFrom: '2026-04-01' }));
  await step('Aurangabad casting unit (rejected)', async () => { const f = await post(U.lead, '/facilities', { entityId: parent.id, name: 'Aurangabad Casting Unit', facilityType: 'MANUFACTURING_PLANT', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra' }); await patch(U.exec, `/facilities/${f.id}/approve`, { status: 'REJECTED' }); });
  await step('Invitation (pending)', () => post(U.admin, '/team/invitations', { email: 'new.plant.manager@bharatgears.in', roles: ['PLANT_MANAGER'], facilityIds: [pune.id] }));
  await step('Invitation (revoked)', async () => { const i = await post(U.admin, '/team/invitations', { email: 'contractor@bharatgears.in', roles: ['FINANCE_MANAGER'] }); await del(U.admin, `/team/invitations/${i.id ?? i.invitation?.id}`); });
  await step('Quarterly access review certified', () => post(U.admin, '/access-certifications', { periodLabel: 'FY2026-27 Q2', notes: 'All seven accounts reviewed. No change needed.' }));
  const apiKey = await step('API key for the ERP connection', () => post(U.admin, '/org/api-keys', { name: 'ERP to Tropos (demo)', facilityIds: [pune.id], scopes: ['ingest:entries'] }));
  await step('Second API key, revoked', async () => { const k = await post(U.admin, '/org/api-keys', { name: 'Old test key (revoked)', facilityIds: [], scopes: ['ingest:entries'] }); const id = k.id ?? k.apiKey?.id ?? k.key?.id ?? rows(await get(U.admin, '/org/api-keys')).find((x: any) => x.name?.includes('revoked'))?.id; await del(U.admin, `/org/api-keys/${id}`); });

  // ───────────────────────────── 2. Sources and equipment (Lead, Plant manager)
  console.log('\n2. Meters and sources');
  const mk = (name: string, domain: string, scope: string, unit: string, code: string | undefined, serial: string, facilityId = pune.id, who = U.lead) =>
    step(`Source ${name}`, () => post(who, '/sources', { facilityId, name, domain, scope, canonicalUnit: unit, defaultFactorId: code ? fac(code)?.id : undefined, meterSerialNo: serial, effectiveFrom: '2026-04-01' }));
  const lpg = await mk('LPG-210 · Canteen LPG cylinders', 'FUEL', 'SCOPE_1', 'kg', 'FUEL_LPG_STAT', 'LPG-210');
  const png = await mk('PNG-311 · Heat-treatment furnace gas', 'FUEL', 'SCOPE_1', 'SCM', 'FUEL_PNG_STAT', 'PNG-311');
  const coal = await mk('CL-520 · Foundry coal', 'FUEL', 'SCOPE_1', 'MT', 'FUEL_COAL_BIT', 'CL-520');
  const pel = await mk('BIO-612 · Biomass pellet boiler', 'FUEL', 'BIOGENIC', 'MT', 'FUEL_BIOMASS_PEL', 'BIO-612');
  const nashikGrid = nashik && await mk('ELC-901 · Nashik grid meter', 'ELECTRICITY_THERMAL', 'SCOPE_2', 'kWh', 'IN_GRID_FY25_26', 'ELC-901', nashik.id);
  await step('Refrigerant equipment: cold-room compressor', () => post(U.plant, '/resources/refrigerants', { facilityId: pune.id, equipmentName: 'Tool-room Chiller #2', refrigerantCode: 'R_404A', nameplateKg: 22, defaultLeakPct: 6 }));
  const allSources = rows(await get(U.lead, '/sources')); const s2 = (n: string) => allSources.find((x: any) => x.name.startsWith(n));
  const equipment = rows(await get(U.plant, '/resources/refrigerants'));
  const chiller = equipment.find((e: any) => e.equipmentName.includes('#1')) ?? equipment[0];
  const refSrc = allSources.find((x: any) => x.domain === 'REFRIGERANT');

  // ───────────────────────────── 3. April 2026 activity data, in every state (Plant manager enters, Lead reviews)
  console.log('\n3. Energy and fuel entries (every state)');
  const base = { periodId: P.id, billingStartDate: '2026-05-01', billingEndDate: '2026-05-31' };
  const evA = await step('Evidence: boiler diesel invoice', () => upload(U.plant, 'HSD-invoice-Apr2026.pdf', 'HSD invoice April 2026'));
  const evB = await step('Evidence: electricity bill', () => upload(U.plant, 'MSEDCL-bill-Apr2026.pdf', 'MSEDCL bill April 2026'));
  const e1 = await step('Boiler diesel 8,200 L → approved', async () => { const e = await post(U.plant, '/entries', { ...base, sourceId: src('BLR-102').id, rawQuantity: 8200, rawUnit: 'L', costInr: 738000, invoiceNumber: 'HSD-APR-0412', evidenceFileId: evA }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'APPROVED' }); return e; });
  await step('Grid electricity 41,800 kWh (6,000 solar self-used) → approved', async () => { const e = await post(U.plant, '/entries', { ...base, sourceId: src('ELC-407').id, rawQuantity: 41800, rawUnit: 'kWh', grossGridImportKwh: 41800, onsiteSolarSelfConsumedKwh: 6000, costInr: 389000, invoiceNumber: 'MSEDCL-APR-7731', evidenceFileId: evB }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'APPROVED' }); });
  await step('Backup DG 640 L → rejected with a note, corrected, resubmitted (waiting for review)', async () => { const e = await post(U.plant, '/entries', { ...base, sourceId: src('DG-404').id, rawQuantity: 640, rawUnit: 'L', invoiceNumber: 'HSD-DG-0419' }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'REJECTED', reviewNote: 'Invoice date is 28 April. Please attach the May invoice.' }); await patch(U.plant, `/entries/${e.id}`, { rawQuantity: 610, invoiceNumber: 'HSD-DG-0502' }); await post(U.plant, `/entries/${e.id}/submit`); });
  const annex = await mk('ELC-902 · Annexe sub-meter', 'ELECTRICITY_THERMAL', 'SCOPE_2', 'kWh', 'IN_GRID_FY25_26', 'ELC-902');
  await step('Annexe sub-meter 3,100 kWh → draft', async () => { if (annex) await post(U.plant, '/entries', { ...base, sourceId: annex.id, rawQuantity: 3100, rawUnit: 'kWh', invoiceNumber: 'ANX-APR-03' }); });
  await step('Press-shop sub-meter 2,400 kWh → rejected, waiting for the plant to fix', async () => { const m = await mk('ELC-903 · Press-shop sub-meter', 'ELECTRICITY_THERMAL', 'SCOPE_2', 'kWh', 'IN_GRID_FY25_26', 'ELC-903'); if (!m) return; const e = await post(U.plant, '/entries', { ...base, sourceId: m.id, rawQuantity: 2400, rawUnit: 'kWh', invoiceNumber: 'PRS-APR-01' }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'REJECTED', reviewNote: 'This sub-meter is already included in the main grid meter. Remove it or explain.' }); });
  await step('Canteen LPG 380 kg (estimated) → waiting for review', async () => { if (!lpg) return; const e = await post(U.plant, '/entries', { ...base, sourceId: lpg.id, dataBasis: 'ESTIMATED_PROXY', rawQuantity: 380, rawUnit: 'kg', estimationMethod: 'Cylinders issued by the stores register: 27 cylinders of 14.2 kg.' }); await post(U.plant, `/entries/${e.id}/submit`); });
  await step('Heat-treatment gas: nil activity (plant shut for maintenance) → approved', async () => { if (!png) return; const e = await post(U.plant, '/entries', { ...base, sourceId: png.id, dataBasis: 'NIL_ACTIVITY', rawQuantity: 0, rawUnit: 'SCM', estimationMethod: 'Furnace under annual refractory repair, no gas drawn in May.' }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'APPROVED' }); });
  await step('Foundry coal 14 t → withdrawn (entered in error)', async () => { if (!coal) return; const e = await post(U.plant, '/entries', { ...base, sourceId: coal.id, rawQuantity: 14, rawUnit: 'MT', invoiceNumber: 'COAL-1002' }); await del(U.plant, `/entries/${e.id}`); });
  await step('Refrigerant top-up 3.2 kg R-410A → waiting for review', async () => { if (!refSrc || !chiller) return; const e = await post(U.plant, '/entries', { ...base, sourceId: refSrc.id, rawQuantity: 3.2, rawUnit: 'kg', refrigerantEquipmentId: chiller.id, refrigerantMethod: 'MATERIAL_BALANCE', invoiceNumber: 'GAS-REFILL-77' }); await post(U.plant, `/entries/${e.id}/submit`); });
  await step('Biomass pellets 5.1 t (biogenic, kept separate) → approved', async () => { if (!pel) return; const e = await post(U.plant, '/entries', { ...base, sourceId: pel.id, rawQuantity: 5.1, rawUnit: 'MT', invoiceNumber: 'PEL-0091' }); await post(U.plant, `/entries/${e.id}/submit`); await post(U.lead, `/entries/${e.id}/review`, { decision: 'APPROVED' }); });
  await step('Unusually high diesel (flagged, explained) → waiting for review', async () => { const e = await post(U.plant, '/entries', { ...base, sourceId: src('FLT-802').id, rawQuantity: 9800, rawUnit: 'L', invoiceNumber: 'PET-APR-BULK' }); await post(U.plant, `/entries/${e.id}/submit`, e.flags?.length ? { outlierConfirmed: true, outlierNote: 'Bulk fill for the new route to the Chennai customer.' } : {}).catch(() => post(U.plant, `/entries/${e.id}/submit`, { outlierConfirmed: true, outlierNote: 'Bulk fill for the new route to the Chennai customer.' })); });
  await step('Nashik electricity by the lead → approved by the executive (two-person rule)', async () => { if (!nashikGrid) return; const e = await post(U.lead, '/entries', { ...base, sourceId: nashikGrid.id, rawQuantity: 5200, rawUnit: 'kWh', invoiceNumber: 'NSK-APR-12' }); await post(U.lead, `/entries/${e.id}/submit`); await post(U.exec, `/entries/${e.id}/review`, { decision: 'APPROVED' }); });
  await step('Entry sent by the ERP through the API key (waiting as a draft)', async () => { if (!apiKey?.rawKey) throw new Error('no key'); const r = await fetch(`${API}/ingest/entries`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tropos-api-key': apiKey.rawKey }, body: JSON.stringify({ ...base, sourceId: coal!.id, rawQuantity: 6, rawUnit: 'MT', externalRefId: 'ERP-COAL-20260528', invoiceNumber: 'ERP-COAL-0428', billingStartDate: '2026-05-28', billingEndDate: '2026-05-28' }) }); if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`); });

  // ───────────────────────────── 4. Water, waste, air, materials, output
  console.log('\n4. Water, waste, air, materials, output');
  const log = (kind: string, body: any, who = U.plant) => post(who, `/resources/${kind}`, { facilityId: pune.id, periodId: P.id, ...body });
  const flow = async (kind: string, body: any, fate: 'draft' | 'submitted' | 'approved' | 'rejected') => {
    const r = await log(kind, body);
    if (fate !== 'draft') await post(U.plant, `/resources/${kind}/${r.id}/submit`);
    if (fate === 'approved') await post(U.lead, `/resources/${kind}/${r.id}/review`, { decision: 'APPROVED' });
    if (fate === 'rejected') await post(U.lead, `/resources/${kind}/${r.id}/review`, { decision: 'REJECTED', reviewNote: 'Please check this figure against the meter photo and resend.' });
    return r;
  };
  await step('Water: borewell → waiting for review', () => flow('water', { withdrawalSource: 'GROUNDWATER', withdrawalKl: 900, dischargeKl: 0, recycledKl: 0 }, 'submitted'));
  await step('Water: surface (zero liquid discharge) → draft', () => flow('water', { withdrawalSource: 'SURFACE', withdrawalKl: 300, dischargeKl: 40, dischargeDestination: 'ZLD_RECYCLED', recycledKl: 40 }, 'draft'));
  await step('Water: desalinated supply → rejected', () => flow('water', { withdrawalSource: 'SEAWATER_DESALINATED', withdrawalKl: 5000 }, 'rejected'));
  await step('Waste: hazardous oil sludge off site with manifest → approved', () => flow('waste', { wasteCategory: 'OTHER_HAZARDOUS', treatmentRoute: 'INCINERATED_WITH_ENERGY', quantityMt: 1.8, isOnsite: false, manifestRef: 'MPCB-F10-2026-0447' }, 'approved'));
  await step('Waste: plastic scrap recycled → approved', () => flow('waste', { wasteCategory: 'PLASTIC', treatmentRoute: 'RECYCLED', quantityMt: 2.5, isOnsite: false }, 'approved'));
  await step('Waste: used batteries → waiting for review', () => flow('waste', { wasteCategory: 'BATTERY', treatmentRoute: 'RECYCLED', quantityMt: 0.4, isOnsite: false, manifestRef: 'BWMR-2026-118' }, 'submitted'));
  await step('Waste: canteen waste to landfill → draft', () => flow('waste', { wasteCategory: 'OTHER_NON_HAZARDOUS', treatmentRoute: 'LANDFILLED', quantityMt: 1.1, isOnsite: false }, 'draft'));
  await step('Air: NOx within the limit → approved', () => flow('air-emissions', { stackId: 'STK-01 Boiler', pollutant: 'NOX', quantityKg: 112, spcbLimitKg: 160 }, 'approved'));
  await step('Air: particulates above the limit (explained) → waiting for review', () => flow('air-emissions', { stackId: 'STK-02 Furnace', pollutant: 'PM', quantityKg: 58, spcbLimitKg: 40, spcbLimitNote: 'Bag filter replaced on 24 April; retest is within the limit.' }, 'submitted'));
  await step('Air: SOx → draft', () => flow('air-emissions', { stackId: 'STK-01 Boiler', pollutant: 'SOX', quantityKg: 31 }, 'draft'));
  await step('Materials: virgin steel bar → approved', () => flow('materials', { materialName: 'EN8 steel bar', origin: 'VIRGIN', quantityMt: 240, linkedScope3Tco2e: 560 }, 'approved'));
  await step('Materials: recycled aluminium → waiting for review', () => flow('materials', { materialName: 'Recycled aluminium ingot', origin: 'RECYCLED', quantityMt: 18, linkedScope3Tco2e: 24 }, 'submitted'));
  await step('Materials: packaging (EPR) → draft', () => flow('materials', { materialName: 'Corrugated boxes', origin: 'REUSED', quantityMt: 3.2, isPackagingEpr: true }, 'draft'));
  await step('Output: gears produced → approved', () => flow('outputs', { productName: 'Transmission gears', outputValue: 118000, outputUnit: 'units' }, 'approved'));
  await step('Output: shafts → waiting for review', () => flow('outputs', { productName: 'Drive shafts', outputValue: 36000, outputUnit: 'units' }, 'submitted'));
  await step('Waste: e-waste with tracking number → waiting for review', () => flow('waste', { wasteCategory: 'E_WASTE', treatmentRoute: 'RECYCLED', quantityMt: 0.15, isOnsite: false, manifestRef: 'EPR-EW-2026-3321' }, 'submitted'));
  await step('Waste: first-aid room waste → rejected', () => flow('waste', { wasteCategory: 'BIO_MEDICAL', treatmentRoute: 'INCINERATED_WITHOUT_ENERGY', quantityMt: 0.02, isOnsite: false, manifestRef: 'BMW-2026-77' }, 'rejected'));
  await step('Waste: site debris reused on site → draft', () => flow('waste', { wasteCategory: 'CONSTRUCTION_DEMOLITION', treatmentRoute: 'REUSED', quantityMt: 6, isOnsite: true }, 'draft'));
  await step('Air: PM10 at the foundry stack → approved', () => flow('air-emissions', { stackId: 'STK-03 Foundry', pollutant: 'PM10', quantityKg: 22, spcbLimitKg: 35 }, 'approved'));
  await step('Air: VOC from the paint booth → rejected', () => flow('air-emissions', { stackId: 'STK-04 Paint booth', pollutant: 'VOC', quantityKg: 410 }, 'rejected'));
  await step('Materials: lubricants → rejected', () => flow('materials', { materialName: 'Cutting oil', origin: 'VIRGIN', quantityMt: 4.4 }, 'rejected'));
  await step('Output: castings → draft', () => flow('outputs', { productName: 'Iron castings', outputValue: 9200, outputUnit: 'units' }, 'draft'));
  await step('Output: forgings → rejected', () => flow('outputs', { productName: 'Forged blanks', outputValue: 540000, outputUnit: 'units' }, 'rejected'));

  // April: a complete, clean month, closed and waiting for the executive's sign-off.
  console.log('\nApril 2026 (clean, closed)');
  await step('April: every source filled in, reviewed and the month closed', async () => {
    const all = rows(await get(U.lead, '/sources')).filter((x: any) => ['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT'].includes(x.domain) && !x.effectiveTo);
    const aprBase = { periodId: APR.id, billingStartDate: '2026-04-01', billingEndDate: '2026-04-30' };
    const qty = (u: string) => (/kwh/i.test(u) ? 38000 : /^(l|litre|litres)$/i.test(u) ? 2600 : /scm/i.test(u) ? 700 : /mt/i.test(u) ? 4 : 120);
    const existing = rows(await get(U.lead, `/entries?periodId=${APR.id}`));
    let n = 0;
    for (const so of all) {
      const nashikSrc = so.facilityId === nashik?.id;
      const maker = nashikSrc ? U.lead : U.plant, checker = nashikSrc ? U.exec : U.lead;
      let e = existing.find((x: any) => x.sourceId === so.id && x.status !== 'WITHDRAWN');
      if (!e) {
        const body: any = so.domain === 'REFRIGERANT'
          ? { ...aprBase, sourceId: so.id, dataBasis: 'NIL_ACTIVITY', rawQuantity: 0, rawUnit: so.canonicalUnit, estimationMethod: 'No refrigerant was added to any equipment in April.' }
          : { ...aprBase, sourceId: so.id, rawQuantity: qty(so.canonicalUnit), rawUnit: so.canonicalUnit, invoiceNumber: `APR-${so.meterSerialNo ?? n}` };
        e = await post(maker, '/entries', body);
      }
      if (so.domain !== 'REFRIGERANT') await upload(maker === U.exec ? U.lead : maker, `bill-${so.meterSerialNo ?? n}-Apr2026.pdf`, `Bill ${so.name} April 2026`, e.id).catch(() => undefined);
      if (e.status === 'DRAFT' || e.status === 'REJECTED') await post(maker, `/entries/${e.id}/submit`, {}).catch(() => post(maker, `/entries/${e.id}/submit`, { outlierConfirmed: true, outlierNote: 'Normal seasonal level for this plant.' }));
      if (e.status !== 'APPROVED') await post(checker, `/entries/${e.id}/review`, { decision: 'APPROVED' });
      n++;
    }
    await post(U.lead, `/periods/${APR.id}/close`, {});
  });

  // ───────────────────────────── 5. Governance (Lead, Executive)
  console.log('\n5. Governance and approvals');
  const x = (scope3Category: number, item: string) => ({ financialYear: 'FY2026-27', scope: 'SCOPE_3', scope3Category, excludedItemName: item, justification: 'Not captured centrally yet. Estimated at under one percent of the inventory.', estimatedMaterialityPct: 0.6 });
  await step('Boundary exclusion → waiting for approval', () => post(U.lead, '/boundary-exclusions', x(6, 'Business travel by sales staff')));
  await step('Boundary exclusion → approved', async () => { const e = await post(U.lead, '/boundary-exclusions', x(7, 'Employee commuting')); await patch(U.exec, `/boundary-exclusions/${e.id}/decide`, { status: 'APPROVED' }); });
  await step('Boundary exclusion → rejected', async () => { const e = await post(U.lead, '/boundary-exclusions', x(9, 'Downstream transport of spares')); await patch(U.exec, `/boundary-exclusions/${e.id}/decide`, { status: 'REJECTED' }); });
  const impBody = (fy: string) => ({ financialYear: fy, consolidationNarrative: 'Operational control across all subsidiaries and the Pune and Nashik sites.', methodologyNarrative: 'GHG Protocol Corporate Standard, IPCC AR6 GWP, CEA grid factors.', qaQcProcedures: 'Plant enters, lead reviews, executive signs off. Quarterly internal audit.', exclusionPolicy: 'Sources below one percent can be excluded with executive approval.' });
  await step('Inventory plan FY2025-26 → approved', async () => { const i = await post(U.lead, '/imp', impBody('FY2025-26')); await patch(U.exec, `/imp/${i.id}/approve`); });
  await step('Inventory plan FY2026-27 → waiting for approval', () => post(U.lead, '/imp', impBody('FY2026-27')));
  const fz = (code: string, name: string, kg: number) => ({ code, name, domain: 'FUEL', scope: 'SCOPE_1', sourceAuthority: 'Plant laboratory test report', canonicalUnit: 'kg', co2KgPerUnit: kg, validFrom: '2026-04-01' });
  await step('Custom factor → waiting for approval', () => post(U.lead, '/factors', fz('LAB_COAL_PLANT_A', 'Foundry coal, laboratory result', 2.31)));
  await step('Custom factor → approved', async () => { const f = await post(U.lead, '/factors', fz('LAB_PET_COKE', 'Pet coke, laboratory result', 3.2)); await patch(U.exec, `/factors/${f.id}/approve`, { decision: 'APPROVED' }); });
  await step('Custom factor → rejected', async () => { const f = await post(U.lead, '/factors', fz('LAB_WOOD_X', 'Wood chips, untested', 1.1)); await patch(U.exec, `/factors/${f.id}/approve`, { decision: 'REJECTED' }); });
  await step('Past-figure correction → waiting for decision', () => post(U.lead, '/recalculations', { triggerType: 'STRUCTURAL_ACQUISITION', affectedPeriodIds: [MAR.id], estimatedImpactPct: 4.2, reason: 'Acquired the Nashik warehouse on 1 March; the base year must include it.' }));
  await step('Past-figure correction → rejected', async () => { const r = await post(U.lead, '/recalculations', { triggerType: 'METHODOLOGY_CHANGE', affectedPeriodIds: [MAR.id], estimatedImpactPct: 0.4, reason: 'Switch to supplier-specific freight factors for one lane.' }); await patch(U.exec, `/recalculations/${r.id}/decide`, { status: 'REJECTED', decisionNote: 'Impact is below our restatement threshold.' }); });
  await step('Past-figure correction → approved, and February reopened', async () => { const r = await post(U.lead, '/recalculations', { triggerType: 'ERROR_CORRECTION', affectedPeriodIds: [FEB.id], estimatedImpactPct: 3.5, reason: 'Boiler meter calibration error found by the internal audit.' }); await patch(U.exec, `/recalculations/${r.id}/decide`, { status: 'APPROVED', decisionNote: 'Calibration certificate attached.' }); await post(U.exec, `/periods/${FEB.id}/reopen`, { reason: 'Boiler meter calibration error found by the internal audit.' }); });

  // ───────────────────────────── 6. Value chain (Finance, Lead)
  console.log('\n6. Suppliers, Scope 3, green energy and credits');
  const sup = (name: string, category: string, share: number, top = false) => ({ name, contactEmail: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@supplier.example`, category, tradeSharePct: share, isTop2PctPartner: top });
  const s1 = await step('Supplier: Shree Steel Traders', () => post(U.fin, '/suppliers', sup('Shree Steel Traders', 'Steel', 31, true)));
  const s2x = await step('Supplier: Kaveri Logistics', () => post(U.fin, '/suppliers', sup('Kaveri Logistics', 'Freight', 9)));
  const s3 = await step('Supplier: Deccan Forgings', () => post(U.fin, '/suppliers', sup('Deccan Forgings', 'Forgings', 14, true)));
  const s4 = await step('Supplier: Sahyadri Packaging', () => post(U.fin, '/suppliers', sup('Sahyadri Packaging', 'Packaging', 3)));
  const s5 = await step('Supplier: Narmada Alloys', () => post(U.fin, '/suppliers', sup('Narmada Alloys', 'Alloys', 6)));
  const portal = async (tok: string) => { await fetch(`${API}/supplier-portal/${tok}/request-otp`, { method: 'POST' }); await new Promise((r) => setTimeout(r, 300)); };
  const otpFor = async (email: string) => { const m = await prisma.emailOutbox.findFirst({ where: { category: 'SUPPLIER_OTP', toEmail: email }, orderBy: { createdAt: 'desc' } }); return (m?.bodyText ?? '').split(': ')[1]?.trim().slice(0, 6); };
  const verify = async (tok: string, email: string) => { await portal(tok); const code = await otpFor(email); const r = await fetch(`${API}/supplier-portal/${tok}/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otpCode: code }) }); if (!r.ok) throw new Error(`OTP verify ${r.status}`); };
  const submitVal = async (tok: string, v: number) => { const r = await fetch(`${API}/supplier-portal/${tok}/submit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ submittedFactorVal: v, submittedUnit: 'kg', methodologyNote: 'ISO 14067 cradle-to-gate assessment, third-party verified.' }) }); if (!r.ok) throw new Error(`Submit ${r.status}`); };
  const pcf = (s: any, d: string) => post(U.lead, `/suppliers/${s.id}/pcf-requests`, { productDescription: d });
  const q1 = s1 && (await step('Request to Shree Steel → supplier answers → accepted (becomes a factor)', async () => { const q = await pcf(s1, 'EN8 steel bar'); await verify(q.rawToken, s1.contactEmail); await submitVal(q.rawToken, 2.1); await patch(U.lead, `/supplier-requests/${q.request.id}/review`, { decision: 'ACCEPTED' }); return q; }));
  if (s2x) await step('Request to Kaveri → sent, no reply yet', () => pcf(s2x, 'Inbound freight, Pune-Chennai lane'));
  if (s3) await step('Request to Deccan → code verified, answer not sent', async () => { const q = await pcf(s3, 'Forged blanks'); await verify(q.rawToken, s3.contactEmail); });
  if (s3) await step('Request to Deccan (second product) → supplier answered, waiting for review', async () => { const q = await pcf(s3, 'Forged flanges'); await verify(q.rawToken, s3.contactEmail); await submitVal(q.rawToken, 3.4); });
  if (s4) await step('Request to Sahyadri → answered → rejected with a reason', async () => { const q = await pcf(s4, 'Corrugated boxes'); await verify(q.rawToken, s4.contactEmail); await submitVal(q.rawToken, 0.2); await patch(U.lead, `/supplier-requests/${q.request.id}/review`, { decision: 'REJECTED', reviewNote: 'Value is far below the industry range and has no method statement.' }); });
  if (s5) await step('Request to Narmada → link expired', async () => { const q = await pcf(s5, 'Alloy ingots'); await sqlAsOwner((tx) => tx.$executeRaw`UPDATE "SupplierPcfRequest" SET "expiresAt" = now() - interval '3 days', status = 'EXPIRED' WHERE id = ${q.request.id}`); });
  if (s5) await step('Request to Narmada (re-sent) → first one revoked', async () => { await pcf(s5, 'Alloy ingots'); await pcf(s5, 'Alloy ingots'); });
  const steelFactor = factors.find((f: any) => f.code === 'S3_SPEND_STEEL_IN');
  const approvedPcf = rows(await get(U.fin, '/factors')).find((f: any) => f.sourceAuthority?.toLowerCase().includes('supplier') || f.code?.startsWith('SUP'));
  const spend = (c: number, d: string, qty: number, unit: string, method: string, extra: any = {}) => ({ periodId: P.id, scope3Category: c, method, description: d, quantity: qty, unit, factorId: steelFactor?.id, ...extra });
  const rev = (who: string, id: string, body: any) => post(who, `/scope3-purchases/${id}/review`, body);
  await step('Scope 3 purchase (spend-based) → approved', async () => { const p = await post(U.fin, '/scope3-purchases', spend(1, 'Steel bar, May', 240, 'INR_1000', 'SPEND_BASED', { spendInr: 24000000, supplierId: s1?.id })); await post(U.fin, `/scope3-purchases/${p.id}/submit`); await rev(U.lead, p.id, { decision: 'APPROVED' }); });
  await step('Scope 3 purchase using the supplier-confirmed value → approved', async () => { const f = rows(await get(U.fin, '/factors')).find((x: any) => x.organizationId && x.sourceAuthority && /supplier/i.test(x.sourceAuthority + x.name)); if (!f) throw new Error('supplier factor not found'); const p = await post(U.fin, '/scope3-purchases', { periodId: P.id, scope3Category: 1, method: 'SUPPLIER_PCF', description: 'EN8 steel bar with supplier footprint', quantity: 240000, unit: 'kg', factorId: f.id, supplierId: s1?.id }); await post(U.fin, `/scope3-purchases/${p.id}/submit`); await rev(U.lead, p.id, { decision: 'APPROVED' }); });
  await step('Scope 3 purchase (supplier value) → draft', () => post(U.fin, '/scope3-purchases', spend(1, 'Forged blanks, May', 90, 'INR_1000', 'AVERAGE_DATA', { supplierId: s3?.id })));
  await step('Scope 3 purchase (average data) → waiting for review', async () => { const p = await post(U.fin, '/scope3-purchases', spend(4, 'Inbound freight', 50, 'INR_1000', 'AVERAGE_DATA', { supplierId: s2x?.id })); await post(U.fin, `/scope3-purchases/${p.id}/submit`); });
  await step('Scope 3 purchase (hybrid) → rejected', async () => { const p = await post(U.fin, '/scope3-purchases', spend(1, 'Alloy ingots', 60, 'INR_1000', 'HYBRID', { supplierId: s5?.id })); await post(U.fin, `/scope3-purchases/${p.id}/submit`); await rev(U.lead, p.id, { decision: 'REJECTED', reviewNote: 'Use the supplier value once their answer is in.' }); });
  for (const [fy, rev2] of [['FY2025-26', 5200000000], ['FY2026-27', 2750000000]] as const) await step(`Financials ${fy}`, () => post(U.fin, '/financial-metrics', { financialYear: fy, revenueInr: rev2, imfPppFactor: 20.38, pppReferenceYear: 2025, consolidatedOutputValue: 1_400_000, consolidatedOutputUnit: 'units', valueChainCoveragePct: 46 }));
  const inst = await step('Green power certificate (I-REC) that passes all four checks', () => post(U.fin, '/scope2-instruments', { facilityId: pune.id, instrumentType: 'I_REC', providerName: 'Sunrise Green Power', certificateRef: 'IREC-IN-2026-00418', validFrom: '2026-04-01', validTo: '2027-03-31', totalMwh: 300, factorKgCo2ePerKwh: 0, retirementRef: 'RET-2026-8841', criteria: { conveysAttributes: true, uniqueClaim: true, retired: true, sameMarket: true } }));
  await step('Allocate 25 MWh of it to May', async () => { if (inst) await post(U.fin, `/scope2-instruments/${inst.id}/allocate`, { periodId: P.id, allocatedMwh: 25 }); });
  await step('Green power certificate that fails a check (not retired)', () => post(U.fin, '/scope2-instruments', { facilityId: pune.id, instrumentType: 'REC', providerName: 'Western Wind Co', certificateRef: 'REC-WW-2026-0007', validFrom: '2026-04-01', validTo: '2027-03-31', totalMwh: 120, factorKgCo2ePerKwh: 0, criteria: { conveysAttributes: true, uniqueClaim: true, retired: false, sameMarket: true } }));
  const credit = (cls: string, serial: string, qty: number, status: 'ISSUED' | 'PROCURED', extra: any = {}) => ({ entityId: parent.id, instrumentClass: cls, registryName: cls === 'VOLUNTARY_CARBON_CREDIT' ? 'VERRA' : cls === 'BEE_CCTS_ICC' ? 'BEE CCTS' : 'MoEFCC', projectId: `PRJ-${serial}`, serialRange: serial, vintageYear: 2025, quantity: qty, status, ...extra });
  await step('Credit: issued (BEE carbon credit)', () => post(U.lead, '/green-economy/credits', credit('BEE_CCTS_ICC', 'ICC-0001-0100', 100, 'ISSUED')));
  await step('Credit: procured (voluntary)', () => post(U.lead, '/green-economy/credits', credit('VOLUNTARY_CARBON_CREDIT', 'VCS-7781-A', 250, 'PROCURED')));
  await step('Credit: waiting to be retired', async () => { const c = await post(U.lead, '/green-economy/credits', credit('VOLUNTARY_CARBON_CREDIT', 'VCS-7781-B', 80, 'PROCURED')); await patch(U.lead, `/green-economy/credits/${c.id}/status`, { status: 'PENDING_RETIREMENT' }); });
  await step('Credit: retired', async () => { const c = await post(U.lead, '/green-economy/credits', credit('VOLUNTARY_CARBON_CREDIT', 'VCS-7781-C', 60, 'PROCURED')); await patch(U.lead, `/green-economy/credits/${c.id}/status`, { status: 'PENDING_RETIREMENT' }); await patch(U.exec, `/green-economy/credits/${c.id}/status`, { status: 'RETIRED' }); });
  await step('Credit: green credit (forest restoration, MoEFCC)', () => post(U.lead, '/green-economy/credits', credit('MOEFCC_GREEN_CREDIT', 'GC-MH-5521', 40, 'PROCURED', { canopyDensityPct: 48, restorationYears: 7, restorationParcelId: 'PUNE-KHED-114' })));
  await step('Credit: moved to a subsidiary', async () => { const c = await post(U.lead, '/green-economy/credits', credit('MOEFCC_GREEN_CREDIT', 'GC-MH-5530', 25, 'ISSUED', { canopyDensityPct: 52, restorationYears: 8, restorationParcelId: 'NSK-DIN-27' })); await patch(U.exec, `/green-economy/credits/${c.id}/status`, { status: 'TRANSFERRED_SUBSIDIARY', transferredToEntityId: sub?.id }); });
  await step('Credit: extinguished', async () => { const c = await post(U.lead, '/green-economy/credits', credit('BEE_CCTS_ICC', 'ICC-0141-0150', 10, 'ISSUED')); await patch(U.exec, `/green-economy/credits/${c.id}/status`, { status: 'EXTINGUISHED' }); });

  // ───────────────────────────── 7. Targets and actions (Lead)
  console.log('\n7. Targets and reduction actions');
  const tgt = (name: string, type: string, cov: string, fw: string, red: number, extra: any = {}) => ({ name, targetType: type, scopeCoverage: cov, framework: fw, baseYear: 'FY2025-26', targetYear: 'FY2029-30', baseValue: 380, targetReductionPct: red, ...extra });
  const t1 = await step('Target: absolute, Scope 1 and 2, near-term SBTi', () => post(U.lead, '/targets', tgt('Cut Scope 1+2 by 42% by FY2029-30', 'ABSOLUTE', 'SCOPE_1_AND_2_LOCATION', 'SBTI_NEAR_TERM', 42)));
  await step('Target: intensity per unit produced', () => post(U.lead, '/targets', tgt('Halve emissions per gear produced', 'INTENSITY', 'SCOPE_1_AND_2_LOCATION', 'CUSTOM_INTERNAL', 50, { intensityUnit: 'tCO2e per 1000 units' })));
  await step('Target: Scope 3, net-zero route', () => post(U.lead, '/targets', tgt('Reduce supplier emissions 25%', 'ABSOLUTE', 'SCOPE_3', 'SBTI_NET_ZERO', 25, { baseValue: 1200 })));
  await step('Target: BEE intensity obligation', () => post(U.exec, '/targets', tgt('BEE CCTS emission-intensity target', 'INTENSITY', 'SCOPE_1', 'BEE_CCTS_GEI', 6, { intensityUnit: 'tCO2e per tonne product' })));
  if (t1) {
    const act = (title: string, domain: string, lever: string, saving: number, capex: number, extra: any = {}) => ({ title, domain, lever, facilityId: pune.id, expectedSavingTco2e: saving, capexInr: capex, annualOpexDeltaInr: -capex * 0.08, lifetimeYears: 10, discountRatePct: 10, endDate: '2027-03-31', ...extra });
    const a = async (b: any) => post(U.lead, `/targets/${t1.id}/actions`, b);
    await step('Action: rooftop solar (planned)', () => a(act('Add 120 kWp rooftop solar', 'ELECTRICITY_THERMAL', 'ONSITE_SOLAR', 95, 5_400_000)));
    await step('Action: boiler to biomass (in progress)', async () => { const x = await a(act('Switch boiler #1 to biomass pellets', 'FUEL', 'FUEL_SWITCH', 160, 3_100_000, { biogenicShiftTco2e: 140 })); await patch(U.lead, `/actions/${x.id}`, { status: 'IN_PROGRESS' }); });
    await step('Action: compressed air leaks (completed)', async () => { const x = await a(act('Fix compressed-air leaks', 'ELECTRICITY_THERMAL', 'ENERGY_EFFICIENCY', 38, 280_000)); await patch(U.lead, `/actions/${x.id}`, { status: 'COMPLETED', achievedSavingTco2e: 41, implementationDate: '2026-02-15' }); });
    await step('Action: LED retrofit (partly achieved)', async () => { const x = await a(act('LED retrofit across shop floor', 'ELECTRICITY_THERMAL', 'ENERGY_EFFICIENCY', 52, 900_000)); await patch(U.lead, `/actions/${x.id}`, { status: 'PARTIALLY_ACHIEVED', achievedSavingTco2e: 30 }); });
    await step('Action: electric delivery vans (delayed)', async () => { const x = await a(act('Replace two delivery vans with electric', 'FUEL', 'FLEET_ELECTRIFICATION', 24, 3_800_000)); await patch(U.lead, `/actions/${x.id}`, { status: 'DELAYED', revisedEndDate: '2027-09-30', delayReason: 'The vehicle supplier moved delivery by two quarters.' }); });
    await step('Action: heat-recovery on furnace (cancelled)', async () => { const x = await a(act('Furnace heat recovery', 'FUEL', 'PROCESS_OPTIMIZATION', 70, 8_000_000)); await patch(U.lead, `/actions/${x.id}`, { status: 'CANCELLED', cancellationReason: 'Quotation was twice the budget and payback is over eight years.' }); });
    await step('Action: swap chiller gas (planned)', () => a(act('Replace R-404A in tool-room chiller', 'REFRIGERANT', 'REFRIGERANT_SWAP', 12, 450_000)));
    await step('Action: water reuse loop (planned)', () => a(act('Treated-water reuse for cooling', 'WATER', 'WATER_CIRCULARITY', 6, 650_000)));
    await step('Action: supplier engagement (in progress)', async () => { const x = await a(act('Ask top suppliers for product footprints', 'RAW_MATERIAL', 'SUPPLIER_ENGAGEMENT', 120, 60_000)); await patch(U.lead, `/actions/${x.id}`, { status: 'IN_PROGRESS' }); });
  }

  // ───────────────────────────── 8. Imports (Plant manager, Lead)
  console.log('\n8. Imports');
  const goodCsv = `sourceName,meterSerialNo,quantity,unit,costInr,invoiceNumber,billingStartDate,billingEndDate,dataBasis\n"${src('FLT-802').name}","FLT-802",480,L,43200,CSV-DEMO-1,2026-05-01,2026-05-31,ACTUAL_METERED\n`;
  await step('CSV import (preview only)', async () => { const r = await csv(U.plant, P.id, goodCsv, false); if (r.status >= 300) throw new Error(JSON.stringify(r.body).slice(0, 200)); });
  await step('CSV import (committed)', async () => { const r = await csv(U.plant, P.id, goodCsv.replace('CSV-DEMO-1', 'CSV-DEMO-2'), true); if (r.status >= 300) throw new Error(JSON.stringify(r.body).slice(0, 200)); });
  await step('CSV import with errors (nothing saved)', async () => { const r = await csv(U.plant, P.id, goodCsv.replace('480', '-5').replace('CSV-DEMO-1', 'CSV-BAD'), true); if (r.status < 400 && !(r.body.errors?.length)) throw new Error('expected a refusal'); });
  await step('Tally import (committed)', async () => { const r = await csv(U.fin, P.id, `LedgerName,Quantity,Unit,Amount,VoucherNo\n"${src('DG-404').name}",120,L,10800,TLY-VCH-9001\n`, true, 'TALLY_ERP', 'tally-export.csv'); if (r.status >= 300) throw new Error(JSON.stringify(r.body).slice(0, 200)); });
  await step('Import rolled back', async () => { const r = await csv(U.plant, P.id, goodCsv.replace('480', '90').replace('CSV-DEMO-1', 'CSV-RB'), true); const id = r.body.batchId ?? r.body.batch?.id; if (id) await post(U.plant, `/imports/batches/${id}/rollback`); else throw new Error('no batch id'); });

  // ───────────────────────────── 9. Assurance (Auditor, Verifier, Lead)
  console.log('\n9. Internal audit and external assurance');
  await step('Internal finding: deficiency', () => post(U.aud, '/internal-audit/findings', { periodId: P.id, controlDomain: 'Fuel records', status: 'DEFICIENCY', summary: 'Two diesel invoices were entered without the delivery challan.', remediation: 'Plant manager to attach challans going forward.' }));
  await step('Internal finding: remediation required', () => post(U.aud, '/internal-audit/findings', { periodId: P.id, controlDomain: 'Meter calibration', status: 'REMEDIATION_REQUIRED', summary: 'Boiler flow meter calibration certificate expired in January.', remediation: 'Recalibrate the meter and file the new certificate before the May close.' }));
  await step('Internal finding: control passed', () => post(U.aud, '/internal-audit/findings', { periodId: P.id, controlDomain: 'Two-person review', status: 'PASS', summary: 'Every approved entry was reviewed by someone other than the person who entered it.' }));
  await step('Internal finding: closed', async () => { const f = await post(U.aud, '/internal-audit/findings', { periodId: MAR.id, controlDomain: 'Evidence retention', status: 'DEFICIENCY', summary: 'Three March bills were missing from the evidence store.', remediation: 'Upload the three bills and add a monthly evidence checklist.' }); await patch(U.aud, `/internal-audit/findings/${f.id}`, { status: 'CLOSED', remediation: 'Bills uploaded and verified.' }); });
  const verifier = await prisma.user.findFirstOrThrow({ where: { email: U.ver } });
  const eng = (over: any) => post(U.lead, '/assurance/engagements', { verifierUserId: verifier.id, verifierFirmName: 'ACVA India LLP', acvaAccreditationNo: 'ACVA/IN/2025/0192', periodIds: [MAR.id], ...over });
  const e1x = await step('Engagement: reasonable assurance (will be issued)', () => eng({ standard: 'ISO_14064_3', assuranceLevel: 'REASONABLE', engagementType: 'VERIFICATION' }));
  const e2x = await step('Engagement: limited assurance (in progress, open questions)', () => eng({ standard: 'ICAI_SSAE_3000', assuranceLevel: 'LIMITED', engagementType: 'ASSURANCE', periodIds: [MAR.id, FEB.id] }));
  const e4x = await step('Engagement: another firm, qualified opinion', () => post(U.lead, '/assurance/engagements', { verifierUserId: verifier.id, verifierFirmName: 'GreenLedger Assurance LLP', engagementType: 'ASSURANCE', assuranceLevel: 'LIMITED', standard: 'ICAI_SSAE_3410', periodIds: [MAR.id] }));
  await step('Engagement: just created', () => eng({ standard: 'SEBI_ISF_ASSESSMENT', engagementType: 'ASSESSMENT', periodIds: [P.id] }));
  if (e1x) {
    const f1 = await step('Verifier question → answered → resolved', async () => { const f = await post(U.ver, `/assurance/engagements/${e1x.id}/findings`, { periodId: MAR.id, severity: 'CLARIFICATION', questionText: 'Please explain the drop in diesel use from February to March.' }); await patch(U.lead, `/assurance/findings/${f.id}/respond`, { responseText: 'A second shift was paused for two weeks for the die change.' }); await patch(U.ver, `/assurance/findings/${f.id}/close`, { status: 'RESOLVED' }); });
    await step('Opinion issued (unmodified)', () => post(U.ver, `/assurance/engagements/${e1x.id}/opinion`, { opinion: 'UNMODIFIED', opinionNotes: 'In our opinion the March inventory is fairly stated in all material respects under ISO 14064-3.' }));
  }
  if (e2x) {
    await step('Opinion issued (qualified)', async () => { if (e4x) await post(U.ver, `/assurance/engagements/${e4x.id}/opinion`, { opinion: 'QUALIFIED', opinionNotes: 'Except for the February boiler fuel records, which lacked a calibration certificate, the inventory is fairly stated.' }); });
    await step('Verifier nonconformity → open', () => post(U.ver, `/assurance/engagements/${e2x.id}/findings`, { periodId: FEB.id, severity: 'NONCONFORMITY', questionText: 'The boiler meter calibration certificate is not on file for February.' }));
    await step('Verifier misstatement → answered, not yet closed', async () => { const f = await post(U.ver, `/assurance/engagements/${e2x.id}/findings`, { periodId: MAR.id, severity: 'MATERIAL_MISSTATEMENT', questionText: 'Grid factor used for March does not match the CEA table for that year.' }); await patch(U.lead, `/assurance/findings/${f.id}/respond`, { responseText: 'We used the FY2025-26 value of 0.675 kg/kWh. We will attach the CEA extract.' }); });
    await step('Verifier question → closed as unresolved', async () => { const f = await post(U.ver, `/assurance/engagements/${e2x.id}/findings`, { periodId: MAR.id, severity: 'CLARIFICATION', questionText: 'Provide the supplier declarations for forged blanks.' }); await patch(U.lead, `/assurance/findings/${f.id}/respond`, { responseText: 'The supplier has not replied yet.' }); await patch(U.ver, `/assurance/findings/${f.id}/close`, { status: 'UNRESOLVED' }); });
  }

  // ───────────────────────────── 10. Reports
  console.log('\n10. Reports');
  await step('Buyer summary (PDF)', async () => { const r = await fetch(`${API}/reports/buyer-pdf?periodId=${MAR.id}`, { headers: { authorization: `Bearer ${await login(U.lead)}` } }); if (!r.ok) throw new Error(`${r.status}`); await r.arrayBuffer(); });
  await step('BRSR core export', async () => { const r = await fetch(`${API}/reports/brsr-core-export?financialYear=FY2025-26`, { headers: { authorization: `Bearer ${await login(U.exec)}` } }); if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`); await r.arrayBuffer(); });
  await step('BEE CCTS Form A', async () => { const r = await fetch(`${API}/reports/ccts-form-a?financialYear=FY2025-26`, { headers: { authorization: `Bearer ${await login(U.exec)}` } }); if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`); await r.arrayBuffer(); });

  // ───────────────────────────── 11. Billing and the platform operator
  console.log('\n11. Billing and platform operator');
  await step('Billing address on the company profile', () => patch(U.admin, '/org/profile', { billingAddress: 'Plot 44, Chakan MIDC Phase II, Pune, Maharashtra 410501' }));
  await step('Upgrade to the mid-market plan (creates an invoice)', () => post(U.admin, '/billing/upgrade', { planCode: 'MID_MARKET' }));
  const inv = rows(await get(U.fin, '/billing/invoices'))[0];
  if (inv) await step('Platform operator records the payment', () => post(U.plat, `/platform/invoices/${inv.id}/mark-paid`, { paymentMethod: 'BANK_TRANSFER', paymentReference: 'NEFT-DEMO-260418' }));
  await step('Another invoice, unpaid', async () => { await post(U.admin, '/billing/upgrade', { planCode: 'ENTERPRISE_BRSR' }); });

  // Other companies, so the platform operator sees every company status.
  const mkOrg = async (name: string, email: string, gst: string, status?: string, reason = 'Demo: status set for the operator screens.') => {
    const r = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationName: name, fullName: `${name.split(' ')[0]} Admin`, email, password: PW, gstin: gst }) });
    if (!r.ok) throw new Error(`register ${name}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    if (status) await patch(U.plat, `/platform/organizations/${(await prisma.organization.findFirstOrThrow({ where: { name } })).id}/status`, { status, reason });
  };
  await step('Company on a trial', () => mkOrg('Sahyadri Castings Pvt. Ltd.', 'owner@sahyadri-castings.in', '27AAKCS1234F1Z5'));
  await step('Company with a payment overdue', () => mkOrg('Kaveri Textiles Pvt. Ltd.', 'owner@kaveri-textiles.in', '33AAKCK5678G1Z2', 'PAST_DUE', 'Invoice unpaid for 45 days.'));
  await step('Company suspended', () => mkOrg('Deccan Steel Works Pvt. Ltd.', 'owner@deccan-steel.in', '36AAKCD9012H1Z9', 'SUSPENDED', 'Suspended after repeated payment failure.'));
  await step('Company active, with a trial extension', async () => { await mkOrg('Narmada Chemicals Pvt. Ltd.', 'owner@narmada-chem.in', '24AAKCN3456J1Z4'); const o = await prisma.organization.findFirstOrThrow({ where: { name: 'Narmada Chemicals Pvt. Ltd.' } }); await post(U.plat, `/platform/organizations/${o.id}/extend-trial`, { days: 14, reason: 'Evaluation extended while their consultant finishes the review.' }); });
  await step('Operator request to close a company (waiting for a second operator)', async () => { const o = await prisma.organization.findFirstOrThrow({ where: { name: 'Deccan Steel Works Pvt. Ltd.' } }); await post(U.plat, '/platform/approvals', { organizationId: o.id, actionType: 'ORG_CLOSE_OFFBOARD', reason: 'Customer asked us to close the account and delete their data.' }); });

  // Some of the queued emails delivered, so the outbox shows both waiting and delivered messages.
  await step('Mark some queued emails as delivered', async () => { const mails = rows(await get(U.admin, '/email-outbox')); let n = 0; for (const m of mails) { if (n >= 6) break; if (m.status === 'PENDING') { try { await post(U.admin, `/email-outbox/${m.id}/mark-sent`); n++; } catch { /* leave it queued */ } } } if (!n) throw new Error('no email could be dispatched'); });

  // A second platform operator, so the two-operator rule can be shown.
  await step('Second platform operator decides the close request (rejected) and a second one (approved)', async () => {
    const first = await prisma.user.findFirstOrThrow({ where: { email: U.plat } });
    await prisma.user.upsert({ where: { email: 'platform.admin2@tropos.in' }, update: {}, create: { email: 'platform.admin2@tropos.in', fullName: 'Pooja Iyer', passwordHash: first.passwordHash, isPlatformAdmin: true, emailVerifiedAt: new Date(), twoFactorEnabled: true } });
    U.plat2 = 'platform.admin2@tropos.in';
    const pending = (await prisma.platformActionApproval.findMany({ where: { status: 'PENDING' } }))[0];
    if (!pending) throw new Error('no pending request');
    await patch(U.plat2, `/platform/approvals/${pending.id}/decide`, { status: 'REJECTED' });
    await mkOrg('Vindhya Plastics Pvt. Ltd.', 'owner@vindhya-plastics.in', '23AAKCV7788K1Z1');
    const o = await prisma.organization.findFirstOrThrow({ where: { name: 'Vindhya Plastics Pvt. Ltd.' } });
    const a = await post(U.plat, '/platform/approvals', { organizationId: o.id, actionType: 'ORG_CLOSE_OFFBOARD', reason: 'Company wound up; data retention period over.' });
    await patch(U.plat2, `/platform/approvals/${a.id ?? a.approval?.id}/decide`, { status: 'APPROVED' });
  });
  await step('One closure request left waiting for a second operator', async () => { const o = await prisma.organization.findFirstOrThrow({ where: { name: 'Narmada Chemicals Pvt. Ltd.' } }); await post(U.plat, '/platform/approvals', { organizationId: o.id, actionType: 'ORG_CLOSE_OFFBOARD', reason: 'Customer asked to pause and remove data.' }); });

  console.log(`\n${ok} steps done${failures.length ? `, ${failures.length} failed:` : '. All done.'}`);
  failures.forEach((f) => console.log('  - ' + f));
  await prisma.$disconnect();
  if (failures.length) process.exit(1);
}
main().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
