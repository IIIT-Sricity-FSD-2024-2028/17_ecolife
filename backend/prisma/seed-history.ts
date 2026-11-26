/**
 * Demo history: gives the demo company a full financial year of approved data so charts, trends and
 * year-on-year comparisons have something real to draw.
 *
 * Run after `db:seed-demo`:  npm run db:seed-history
 *
 * For each month from Apr 2025 to Mar 2026 it copies the approved April 2026 entries and the approved purchases,
 * scaled by a gentle seasonal curve (more cooling load in summer), a slow downward trend (the plant is
 * improving) and a small per-record variation, so every month differs. Months that do not exist yet
 * are created and marked signed off. Nothing here is used by tests or production.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_DATABASE_URL || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL }) });

const MONTHS = [
  { y: 2025, m: 4 }, { y: 2025, m: 5 }, { y: 2025, m: 6 }, { y: 2025, m: 7 }, { y: 2025, m: 8 }, { y: 2025, m: 9 },
  { y: 2025, m: 10 }, { y: 2025, m: 11 }, { y: 2025, m: 12 }, { y: 2026, m: 1 }, { y: 2026, m: 2 }, { y: 2026, m: 3 },
];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic 0..1 so reruns give the same picture. */
function rnd(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
    // Past months are signed off and locked; this one-off demo load is the only thing allowed to write to them.
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    const org = await tx.organization.findFirstOrThrow({ where: { name: { contains: 'Bharat' } } });
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

    const apr = await tx.reportingPeriod.findFirstOrThrow({ where: { organizationId: org.id, label: 'Apr 2026' } });
    const already = await tx.resourceEntry.count({ where: { organizationId: org.id, status: 'APPROVED', period: { startDate: { lt: apr.startDate } } } });
    if (already > 0) { console.log('History is already there, nothing to do.'); return; }

    const cols = async (table: string) => (await tx.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_name='${table}' ORDER BY ordinal_position`)).map((c) => c.column_name);
    const entryCols = await cols('ResourceEntry');
    const buyCols = await cols('Scope3Purchase');
    const scaled = (c: string) => /^calculated(?!.*Id$)/.test(c) || ['rawQuantity', 'normalizedQuantity', 'costInr', 'grossGridImportKwh', 'onsiteSolarSelfConsumedKwh', 'solarExportedKwh', 'openingStockQty', 'purchasedQty', 'closingStockQty'].includes(c);

    // Taken once, before the loop adds anything, so copies are never copied again.
    const srcEntries = await tx.resourceEntry.findMany({ where: { organizationId: org.id, periodId: apr.id, status: 'APPROVED' }, select: { id: true } });
    const srcBuys = await tx.scope3Purchase.findMany({ where: { organizationId: org.id, status: 'APPROVED' }, select: { id: true } });
    let entries = 0, buys = 0;
    for (let i = 0; i < MONTHS.length; i++) {
      const { y, m } = MONTHS[i];
      const label = `${SHORT[m - 1]} ${y}`;
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      let period = await tx.reportingPeriod.findFirst({ where: { organizationId: org.id, label } });
      if (!period) {
        period = await tx.reportingPeriod.create({ data: { organizationId: org.id, financialYear: 'FY2025-26', month: m, label, startDate: start, endDate: end, status: 'SIGNED_OFF', closedAt: end, signedOffAt: end } });
      }
      // Slow improvement across the year, a summer bump, and a little variation on every record.
      const trend = 1 + 0.011 * (12 - i);
      const season = 1 + 0.09 * Math.sin(((m - 3) / 12) * 2 * Math.PI);

      for (const s of srcEntries) {
        const f = (trend * season * (0.94 + rnd(`${s.id}${label}`) * 0.12)).toFixed(6);
        const pick = entryCols.map((c) => {
          if (c === 'id') return `'hist_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20)`;
          if (c === 'periodId') return `'${period.id}'`;
          if (c === 'billingStartDate') return `'${start.toISOString()}'::timestamp`;
          if (c === 'billingEndDate') return `'${end.toISOString()}'::timestamp`;
          if (c === 'invoiceNumber') return `CASE WHEN "invoiceNumber" IS NULL THEN NULL ELSE "invoiceNumber" || '-${SHORT[m - 1].toUpperCase()}${String(y).slice(2)}' END`;
          if (c === 'externalRefId' || c === 'importBatchId' || c === 'splitGroupId') return 'NULL';
          if (scaled(c)) return `"${c}" * ${f}`;
          return `"${c}"`;
        });
        await tx.$executeRawUnsafe(`INSERT INTO "ResourceEntry" (${entryCols.map((c) => `"${c}"`).join(',')}) SELECT ${pick.join(',')} FROM "ResourceEntry" WHERE id = '${s.id}'`);
        entries++;
      }

      for (const b of srcBuys) {
        const f = (trend * (0.9 + rnd(`${b.id}${label}`) * 0.2)).toFixed(6);
        const pick = buyCols.map((c) => {
          if (c === 'id') return `'hist_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20)`;
          if (c === 'periodId') return `'${period!.id}'`;
          if (c === 'importBatchId') return 'NULL';
          if (['quantity', 'spendInr', 'calculatedTco2eAr6'].includes(c)) return `"${c}" * ${f}`;
          return `"${c}"`;
        });
        await tx.$executeRawUnsafe(`INSERT INTO "Scope3Purchase" (${buyCols.map((c) => `"${c}"`).join(',')}) SELECT ${pick.join(',')} FROM "Scope3Purchase" WHERE id = '${b.id}'`);
        buys++;
      }
    }
    // Spread the rest of the demo over time too, so company, usage and invoice charts are not a single spike.
    await tx.$executeRawUnsafe(`UPDATE "ResourceEntry" e SET "createdAt" = p."endDate" - interval '3 days', "updatedAt" = p."endDate" - interval '3 days' FROM "ReportingPeriod" p WHERE p.id = e."periodId" AND e.id LIKE 'hist_%'`);
    // The demo logged everything in one afternoon; spread it over the last 30 days, busier on weekdays.
    await tx.$executeRawUnsafe(`UPDATE "AuditLog" SET "createdAt" = now() - ((abs(hashtext(id)) % 30) * interval '1 day') - ((abs(hashtext(id || 'm')) % 600) * interval '1 minute') WHERE "organizationId" = '${org.id}'`);
    await tx.$executeRawUnsafe(`UPDATE "AuditLog" SET "createdAt" = "createdAt" - interval '1 day' WHERE "organizationId" = '${org.id}' AND extract(isodow FROM "createdAt") IN (6, 7) AND abs(hashtext(id || 'w')) % 3 > 0`);
    await tx.$executeRawUnsafe(`UPDATE "Organization" o SET "createdAt" = now() - (r.n * interval '38 days') FROM (SELECT id, row_number() OVER (ORDER BY "createdAt", id) - 1 AS n FROM "Organization") r WHERE r.id = o.id`);
    const paid = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Invoice" WHERE status = 'PAID' ORDER BY "issuedAt" LIMIT 1`);
    const invCols = await cols('Invoice');
    for (let k = 1; k <= 9; k++) {
      if (!paid[0]) break;
      const pick = invCols.map((c) => {
        if (c === 'id') return `'hist_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20)`;
        if (c === 'invoiceNumber') return `'TRP2526/H${String(k).padStart(5, '0')}'`;
        if (['issuedAt', 'dueAt', 'paidAt', 'servicePeriodStart', 'servicePeriodEnd'].includes(c)) return `"${c}" - interval '${k} months'`;
        if (['razorpayPaymentId', 'gatewayOrderId', 'paymentReference'].includes(c)) return 'NULL';
        return `"${c}"`;
      });
      await tx.$executeRawUnsafe(`INSERT INTO "Invoice" (${invCols.map((c) => `"${c}"`).join(',')}) SELECT ${pick.join(',')} FROM "Invoice" WHERE id = '${paid[0].id}'`);
    }
    console.log(`History added: ${entries} entries and ${buys} purchases across ${MONTHS.length} months.`);
  }, { timeout: 120_000 });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
