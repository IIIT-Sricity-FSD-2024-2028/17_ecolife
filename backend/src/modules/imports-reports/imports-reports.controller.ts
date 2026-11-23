import { BadRequestException, Body, ConflictException, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, assertFacilityScope } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { sha256 } from '../../common/utils/crypto.util';
import { buildEntry, entryFieldsSchema } from '../entries/entry-builder';
import { pageResult, parsePaging } from '../../common/utils/paging.util';
import { writeAuditLog } from '../../common/utils/audit.util';

/** Only the newest snapshot of each period counts; older versions are superseded by recalculation. */
function latestPerPeriod<T extends { periodId: string; version: number }>(rows: T[]): T[] {
  const m = new Map<string, T>();
  for (const r of rows) { const c = m.get(r.periodId); if (!c || r.version > c.version) m.set(r.periodId, r); }
  return [...m.values()];
}
const fyOf = (rows: { period: { financialYear: string } }[]) => [...new Set(rows.map((r) => r.period.financialYear))].sort().join(', ') || 'N/A';

@ApiTags('Imports (Tally/CSV) & Regulatory Reports (Buyer PDF, BRSR, CCTS)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)

@Controller()
export class ImportsReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('imports/template')
  async downloadTemplate(@CurrentUser() user: AuthUser, @Query('type') type = 'standard', @Res() res: Response) {
    // The template is built from THIS organization's sources so every name and meter number in it is valid.
    const sources = await this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.resourceSource.findMany({ where: { effectiveTo: null, domain: { in: ['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'RAW_MATERIAL'] } }, include: { defaultFactor: { select: { canonicalUnit: true } } }, orderBy: { name: 'asc' } })
    );
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = type === 'tally'
      ? 'LedgerName,Quantity,Unit,Amount,VoucherNo'
      : 'sourceName,meterSerialNo,quantity,unit,costInr,invoiceNumber,billingStartDate,billingEndDate,dataBasis';
    const rows = sources.map((s) =>
      type === 'tally'
        ? [q(s.name), '', s.defaultFactor?.canonicalUnit ?? s.canonicalUnit, '', ''].join(',')
        : [q(s.name), q(s.meterSerialNo ?? ''), '', s.defaultFactor?.canonicalUnit ?? s.canonicalUnit, '', '', '', '', 'ACTUAL_METERED'].join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tropos_${type}_import_template.csv"`);
    return res.send([head, ...rows].join('\n') + '\n');
  }

  @Get('imports/batches')
  listBatches(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const where: any = { organizationId: user.organizationId!, ...(q.status ? { status: q.status } : {}) };
    const include = { period: { select: { label: true, financialYear: true } }, _count: { select: { entries: true } } };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paged) return tx.importBatch.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 50 });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.importBatch.findMany({ where, include, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.importBatch.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  @Post('imports/csv')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('periodId') periodId: string,
    @Body('commit') commitStr = 'false',
    @Body('channel') channelRaw = 'CSV_EXCEL'
  ) {
    if (!file) throw new BadRequestException('Choose a CSV file to import.');
    if (!periodId || typeof periodId !== 'string') throw new BadRequestException('Choose the reporting period first.');
    {
      const per = await this.prisma.withTenantTx(user.organizationId!, (tx) => tx.reportingPeriod.findFirst({ where: { id: periodId, organizationId: user.organizationId! }, select: { status: true, label: true } }));
      if (!per) throw new BadRequestException('Reporting period not found.');
      if (!['OPEN', 'REOPENED'].includes(per.status)) throw new ConflictException(`${per.label} is closed, so nothing can be imported into it.`);
    }
    const commit = commitStr === 'true';
    const channel = channelRaw === 'TALLY_ERP' ? 'TALLY_ERP' : 'CSV_EXCEL';
    let records: Record<string, string>[];
    try {
      records = parse(file.buffer.toString('utf-8').replace(/^\uFEFF/, ''), { columns: (h: string[]) => h.map((x) => x.trim()), skip_empty_lines: true, trim: true, relax_column_count: false }) as Record<string, string>[];
    } catch (e: any) {
      throw new BadRequestException(`This file is not a valid CSV: ${String(e?.message ?? e).slice(0, 160)}`);
    }
    if (records.length === 0) throw new BadRequestException('The file has no data rows.');
    if (records.length > 5000) throw new BadRequestException('A single import can hold at most 5,000 rows. Split the file.');
    const fileHash = sha256(file.buffer);
    const orgId = user.organizationId!;
    const headers = Object.keys(records[0]).map((h) => h.toLowerCase());
    const hasSource = ['sourcename', 'ledgername', 'particulars', 'meterserialno'].some((h) => headers.includes(h));
    const hasQty = ['quantity', 'billedqty'].some((h) => headers.includes(h));
    if (!hasSource || !hasQty) throw new BadRequestException('The file headers are not recognised. It needs a source column (sourceName, LedgerName or meterSerialNo) and a quantity column. Download the template and use its headers.');
    if (commit) {
      const already = await this.prisma.withTenantTx(orgId, (tx) => tx.importBatch.findFirst({ where: { organizationId: orgId, fileSha256: fileHash, status: 'COMMITTED' }, select: { id: true } }));
      if (already) throw new ConflictException('This exact file was already imported. Roll that batch back first if you need to import it again.');
    }
    const num = (v: string | undefined) => (v == null || v === '' ? NaN : Number(String(v).replace(/,/g, '')));
    const pick = (row: Record<string, string>, ...keys: string[]) => {
      const lower = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
      for (const k of keys) { const v = lower.get(k.toLowerCase()); if (v !== undefined && v !== '') return v; }
      return undefined;
    };

    // Pass 1 (dry run, always rolled back): validate every row with the SAME rules as manual entry, including duplicates inside the file.
    class DryRunDone extends Error { constructor(public result: { errors: { row: number; reason: string }[]; preview: any[] }) { super('dry-run'); } }
    const validateAll = async (tx: any, write: boolean, batchId?: string) => {
      const sources = await tx.resourceSource.findMany();
      const byCode = new Map<string, any>(sources.filter((s: any) => s.meterSerialNo).map((s: any) => [s.meterSerialNo.toLowerCase(), s]));
      const byName = new Map<string, any>(sources.map((s: any) => [s.name.toLowerCase(), s]));
      const errors: { row: number; reason: string }[] = [];
      const preview: any[] = [];
      let inserted = 0;
      for (let idx = 0; idx < records.length; idx++) {
        const row = records[idx];
        const rowNum = idx + 2;
        const name = pick(row, 'sourceName', 'LedgerName', 'Particulars');
        const meter = pick(row, 'meterSerialNo');
        const src = (meter && byCode.get(meter.toLowerCase())) || (name && byName.get(name.toLowerCase()));
        if (!src) { errors.push({ row: rowNum, reason: `No source matches "${name ?? meter ?? ''}". Download the template to see your source names.` }); continue; }
        if (!assertFacilityScope(user, src.facilityId)) { errors.push({ row: rowNum, reason: `You are not assigned to ${src.name}'s facility.` }); continue; }
        const qty = num(pick(row, 'quantity', 'Quantity', 'BilledQty'));
        if (Number.isNaN(qty)) { errors.push({ row: rowNum, reason: 'Quantity is missing or not a number.' }); continue; }
        const cost = num(pick(row, 'costInr', 'Amount', 'Value'));
        const dataBasis = (pick(row, 'dataBasis') ?? (qty === 0 ? 'NIL_ACTIVITY' : 'ACTUAL_METERED')).toUpperCase();
        const parsed = entryFieldsSchema.safeParse({
          periodId,
          sourceId: src.id,
          dataBasis,
          rawQuantity: qty,
          rawUnit: pick(row, 'unit', 'Unit') ?? src.canonicalUnit,
          costInr: Number.isNaN(cost) ? undefined : cost,
          invoiceNumber: pick(row, 'invoiceNumber', 'VoucherNo', 'Voucher No.'),
          billingStartDate: pick(row, 'billingStartDate'),
          billingEndDate: pick(row, 'billingEndDate'),
          estimationMethod: pick(row, 'estimationMethod')
        });
        if (!parsed.success) { errors.push({ row: rowNum, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }); continue; }
        try {
          const { data } = await buildEntry(tx, orgId, parsed.data);
          // Write inside the dry run too so later rows see earlier rows (duplicate invoices / overlapping bills in one file).
          await tx.resourceEntry.create({ data: { organizationId: orgId, status: 'DRAFT', submittedById: user.userId, importBatchId: batchId ?? null, ...data } });
          inserted++;
          if (preview.length < 25) preview.push({ row: rowNum, source: src.name, quantity: qty, unit: parsed.data.rawUnit, tco2e: data.calculatedTco2eAr6, flags: data.qualityFlags });
        } catch (e: any) {
          errors.push({ row: rowNum, reason: String(e?.response?.message ?? e?.message ?? 'Row rejected').slice(0, 300) });
        }
      }
      return { errors, preview, inserted };
    };

    const dry = await this.prisma
      .withTenantTx(orgId, async (tx) => {
        const r = await validateAll(tx, false);
        throw new DryRunDone({ errors: r.errors, preview: r.preview });
      })
      .catch((e) => {
        if (e instanceof DryRunDone) return e.result;
        throw e;
      });

    const canCommit = commit && dry.errors.length === 0;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (canCommit) {
        const dupBatch = await tx.importBatch.findFirst({ where: { organizationId: orgId, fileSha256: fileHash, status: 'COMMITTED' } });
        if (dupBatch) throw new ConflictException('This exact file was already imported. Roll that batch back first if you need to import it again.');
      }
      const batch = await tx.importBatch.create({
        data: {
          organizationId: orgId,
          periodId,
          channel,
          fileName: file.originalname.slice(0, 200),
          fileSha256: fileHash,
          totalRows: records.length,
          validRows: records.length - new Set(dry.errors.map((e) => e.row)).size,
          errorRows: new Set(dry.errors.map((e) => e.row)).size,
          errorSummaryJson: dry.errors.slice(0, 500),
          status: canCommit ? 'COMMITTED' : 'PREVIEW',
          uploadedById: user.userId,
          committedAt: canCommit ? new Date() : null
        }
      });
      let inserted = 0;
      if (canCommit) inserted = (await validateAll(tx, true, batch.id)).inserted;
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: canCommit ? 'IMPORT_COMMITTED' : 'IMPORT_PREVIEWED', resourceType: 'ImportBatch', resourceId: batch.id, metadata: { rows: records.length, errors: dry.errors.length } });
      return { batch, errors: dry.errors, inserted, previewRows: dry.preview, committed: canCommit };
    });
  }

  @Post('imports/batches/:id/rollback')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  rollbackBatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const withdrawn = await tx.resourceEntry.updateMany({ where: { importBatchId: id, status: 'DRAFT' }, data: { status: 'WITHDRAWN' } });
      const batch = await tx.importBatch.update({ where: { id }, data: { status: 'ROLLED_BACK', rolledBackAt: new Date() } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'IMPORT_BATCH_ROLLED_BACK', resourceType: 'ImportBatch', resourceId: id, metadata: { withdrawnDraftEntries: withdrawn.count } });
      return { batch, withdrawnDraftEntries: withdrawn.count };
    });
  }

  @Get('reports/buyer-pdf')
  async buyerPdf(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const orgId = user.organizationId!;
    const summary = await this.prisma.withTenantTx(orgId, async (tx) => {
      const [org, snapshots, targets] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: orgId } }),
        tx.periodSnapshot.findMany({ include: { period: true }, orderBy: { period: { startDate: 'asc' } } }).then(latestPerPeriod),
        tx.target.findMany()
      ]);
      return { org, snapshots, targets };
    });

    const totalS1 = summary.snapshots.reduce((s, x) => s + Number(x.scope1Ar6Tco2e), 0);
    const totalS2 = summary.snapshots.reduce((s, x) => s + Number(x.scope2LocationAr6Tco2e), 0);
    const totalBio = summary.snapshots.reduce((s, x) => s + Number(x.biogenicCo2Tco2e), 0);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', async () => {
      const pdfBuf = Buffer.concat(chunks);
      const fileName = `Tropos_Buyer_Carbon_Summary_${Date.now()}.pdf`;
      await this.prisma.withTenantTx(orgId, async (tx) => {
        await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REPORT_EXPORTED', resourceType: 'ExportReport', resourceId: fileName, metadata: { type: 'SME_BUYER_SUMMARY_PDF' } });
        return tx.exportReport.create({
          data: { organizationId: orgId, financialYear: fyOf(summary.snapshots), reportType: 'SME_BUYER_SUMMARY_PDF', fileName, storageKey: `exports/${orgId}/${fileName}`, fileSha256: sha256(pdfBuf), generatedById: user.userId }
        });
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(pdfBuf);
    });

    doc.fontSize(20).fillColor('#081C2E').text('Tropos — Buyer Carbon Footprint Summary');
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#475569').text(`${summary.org.name}  |  GSTIN: ${summary.org.gstin ?? 'N/A'}  |  Boundary: ${summary.org.consolidationApproach}`);
    doc.moveDown(1.2);
    doc.fontSize(13).fillColor('#081C2E').text('Verified Closed-Period GHG Inventory (IPCC AR6 · grid factors as pinned in each closed period)');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#334155')
      .text(`Scope 1 Direct Fuels & Combustion : ${totalS1.toFixed(2)} tCO2e`)
      .text(`Scope 2 Purchased Electricity     : ${totalS2.toFixed(2)} tCO2e`)
      .text(`Total Scope 1 + 2 (Gross)         : ${(totalS1 + totalS2).toFixed(2)} tCO2e`)
      .text(`Outside-of-Scopes Biogenic CO2    : ${totalBio.toFixed(2)} tCO2e (non-netted)`);
    doc.moveDown(1);
    doc.fontSize(13).fillColor('#081C2E').text('Active Decarbonization Targets');
    summary.targets.forEach((t) => {
      doc.fontSize(10.5).fillColor('#334155').text(`• ${t.name} (${t.baseYear} -> ${t.targetYear}, -${t.targetReductionPct}% | ${t.status})`);
    });
    doc.end();
  }

  @Get('reports/brsr-core-export')
  async brsrExport(@CurrentUser() user: AuthUser, @Query('format') format = 'csv', @Res() res: Response) {
    const orgId = user.organizationId!;
    const data = await this.prisma.withTenantTx(orgId, async (tx) => {
      const [org, snapshots, financials] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: orgId } }),
        tx.periodSnapshot.findMany({ include: { period: true }, orderBy: { period: { startDate: 'asc' } } }).then(latestPerPeriod),
        tx.financialYearMetrics.findMany()
      ]);
      const byFy = new Map<string, any>();
      for (const s of snapshots) {
        const fy = s.period.financialYear;
        const c = byFy.get(fy) ?? { fy, s1: 0, s2Loc: 0, s2Mkt: 0, s3: 0, bio: 0, gj: 0, waterW: 0, waterC: 0, wasteG: 0, wasteR: 0 };
        c.s1 += Number(s.scope1Ar6Tco2e); c.s2Loc += Number(s.scope2LocationAr6Tco2e); c.s2Mkt += Number(s.scope2MarketAr6Tco2e);
        c.s3 += Number(s.scope3Ar6Tco2e); c.bio += Number(s.biogenicCo2Tco2e); c.gj += Number(s.totalEnergyGj);
        c.waterW += Number(s.waterWithdrawalKl); c.waterC += Number(s.waterConsumptionKl);
        c.wasteG += Number(s.wasteGeneratedMt); c.wasteR += Number(s.wasteRecoveredMt);
        byFy.set(fy, c);
      }
      const rows = Array.from(byFy.values()).map((r) => {
        const fin = financials.find((f) => f.financialYear === r.fy);
        const pppUsd = fin ? Number(fin.pppAdjustedRevenueUsd) : null;
        return { ...r, pppUsd, ghgIntensity: pppUsd ? Number(((r.s1 + r.s2Loc) / pppUsd).toFixed(6)) : null };
      });
      const fileName = `Tropos_BRSR_Core_P6_${Date.now()}.${format === 'json' ? 'json' : 'csv'}`;
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REPORT_EXPORTED', resourceType: 'ExportReport', resourceId: fileName, metadata: { type: 'SEBI_BRSR_CORE_P6' } });
      await tx.exportReport.create({
        data: { organizationId: orgId, financialYear: rows.map((r: any) => r.fy).join(', ') || 'N/A', reportType: 'SEBI_BRSR_CORE_P6', fileName, storageKey: `exports/${orgId}/${fileName}`, fileSha256: sha256(JSON.stringify(rows)), generatedById: user.userId }
      });
      return { org, rows, fileName };
    });

    if (format === 'json') return res.json(data);
    const lines = ['FinancialYear,Scope1_tCO2e,Scope2_Loc_tCO2e,Scope2_Mkt_tCO2e,Scope3_tCO2e,Biogenic_CO2,Energy_GJ,Water_Withdrawal_kL,Water_Consumption_kL,Waste_Generated_MT,Waste_Recovered_MT,PPP_Revenue_USD,GHG_Intensity'];
    for (const r of data.rows) {
      lines.push([r.fy, r.s1.toFixed(2), r.s2Loc.toFixed(2), r.s2Mkt.toFixed(2), r.s3.toFixed(2), r.bio.toFixed(2), r.gj.toFixed(2), r.waterW.toFixed(2), r.waterC.toFixed(2), r.wasteG.toFixed(2), r.wasteR.toFixed(2), r.pppUsd ?? '', r.ghgIntensity ?? ''].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${data.fileName}"`);
    return res.send(lines.join('\n'));
  }

  @Get('reports/ccts-form-a')
  async cctsFormA(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const orgId = user.organizationId!;
    const rows = await this.prisma.withTenantTx(orgId, async (tx) => {
      const snaps = await tx.periodSnapshot.findMany({ include: { period: true }, orderBy: { period: { startDate: 'asc' } } }).then(latestPerPeriod);
      const lines = ['FinancialYear,Period,CCTS_Scope1_2_AR2_tCO2e,Total_Energy_GJ,Frozen_Grid_Factor_Note'];
      for (const s of snaps) {
        lines.push([s.period.financialYear, s.period.label, Number(s.cctsScope1And2Ar2Tco2e).toFixed(4), Number(s.totalEnergyGj).toFixed(2), 'BEE CCTS baseline grid factor (frozen)'].join(','));
      }
      const csv = lines.join('\n');
      const fileName = `Tropos_BEE_CCTS_FormA_${Date.now()}.csv`;
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REPORT_EXPORTED', resourceType: 'ExportReport', resourceId: fileName, metadata: { type: 'BEE_CCTS_FORM_A' } });
      await tx.exportReport.create({
        data: { organizationId: orgId, financialYear: fyOf(snaps), reportType: 'BEE_CCTS_FORM_A', fileName, storageKey: `exports/${orgId}/${fileName}`, fileSha256: sha256(csv), generatedById: user.userId }
      });
      return { csv, fileName };
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${rows.fileName}"`);
    return res.send(rows.csv);
  }

  @Get('reports/history')
  history(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const where: any = { organizationId: user.organizationId!, ...(q.reportType ? { reportType: q.reportType } : {}) };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paged) return tx.exportReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.exportReport.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.exportReport.count({ where })]);
      return pageResult(paging, items, total);
    });
  }
}
