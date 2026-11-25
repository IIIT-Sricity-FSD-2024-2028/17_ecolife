import { pageResult, parsePaging } from '../../common/utils/paging.util';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, assertFacilityScope, facilityScope } from '../../common/guards/roles.guard';
import { ApiKeyContext, ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { evaluatePeriodReadiness } from '../../common/utils/verification-rules.util';
import { writeAuditLog, writeEntryHistory } from '../../common/utils/audit.util';
import { anomalyFlags, buildEntry, entryFieldsSchema, loadOpenPeriod } from './entry-builder';

const createEntrySchema = entryFieldsSchema;
const updateEntrySchema = entryFieldsSchema.partial().omit({ periodId: true, sourceId: true }).extend({ version: z.number().int().positive().optional() });
const submitSchema = z.object({ outlierConfirmed: z.boolean().optional(), outlierNote: z.string().trim().min(10).max(1000).optional() }).default({});
const reviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1000).optional()
});
const ingestSchema = entryFieldsSchema.extend({ externalRefId: z.string().trim().min(1).max(120) });

type Tx = Prisma.TransactionClient;

async function loadEntryInScope(tx: Tx, user: AuthUser, id: string) {
  const entry = await tx.resourceEntry.findUnique({ where: { id }, include: { source: true } });
  if (!entry) throw new NotFoundException('Entry not found.');
  if (!assertFacilityScope(user, entry.source.facilityId)) throw new ForbiddenException('You are not assigned to this facility.');
  return entry;
}

@ApiTags('Activity Entries & Period Close')
@Controller()
export class EntriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('ingest/entries')
  @UseGuards(ApiKeyGuard)
  async ingestViaApiKey(@Req() req: { apiKeyAuth: ApiKeyContext }, @Body(new ZodValidationPipe(ingestSchema)) input: z.infer<typeof ingestSchema>) {
    const { organizationId, apiKeyId, facilityIds } = req.apiKeyAuth;
    return this.prisma.withTenantTx(organizationId, async (tx) => {
      // Idempotency: a retried delivery returns the original entry instead of double counting.
      const existing = await tx.resourceEntry.findFirst({ where: { organizationId, externalRefId: input.externalRefId } });
      if (existing) return { duplicate: true, entry: existing };
      const src = await tx.resourceSource.findUnique({ where: { id: input.sourceId }, select: { facilityId: true } });
      if (!src) throw new NotFoundException('Resource source not found.');
      if (facilityIds.length > 0 && !facilityIds.includes(src.facilityId)) throw new ForbiddenException('This API key is not allowed to write to that facility.');
      const { data, source } = await buildEntry(tx, organizationId, input);
      const entry = await tx.resourceEntry.create({
        data: { organizationId, status: 'DRAFT', ingestApiKeyId: apiKeyId, ...data, qualityFlags: [...(data.qualityFlags as string[]), 'INGESTED_VIA_API'] }
      });
      await writeEntryHistory(tx, { organizationId, entryId: entry.id, actorId: `api:${apiKeyId}`, action: 'CREATED_VIA_API', toStatus: 'DRAFT' });
      return { duplicate: false, entry, source: source.name };
    });
  }

  @Get('entries')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  async list(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const orgId = user.organizationId!;
    const scope = facilityScope(user);
    const { periodId, status, sourceId, facilityId, domain } = q;
    if (domain && !['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT'].includes(domain)) throw new BadRequestException('Unknown domain filter.');
    if (status && !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(status)) throw new BadRequestException('Unknown status filter.');
    const paging = parsePaging(q);
    const where = {
      organizationId: orgId,
      ...(periodId ? { periodId } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(status ? { status: status as any } : { status: { not: 'WITHDRAWN' as const } }),
      // Site and type filters; a plant manager can only ever narrow within their own sites.
      ...((scope || facilityId || domain) ? { source: {
        ...(domain ? { domain: domain as any } : {}),
        ...(scope ? { facilityId: facilityId ? (scope.includes(facilityId) ? facilityId : { in: [] as string[] }) : { in: scope } } : (facilityId ? { facilityId } : {}))
      } } : {})
    };
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.resourceEntry.findMany({
          where,
          include: {
            source: { include: { facility: { select: { id: true, name: true, city: true, state: true } }, defaultFactor: true } },
            period: { select: { id: true, label: true, financialYear: true, status: true } },
            evidenceFiles: { select: { id: true, fileName: true, fileSha256: true, isLocked: true } }
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: paging.skip,
          // old callers (no page params) keep the previous 250-row ceiling
          take: paging.paged ? paging.take : 250
        }),
        paging.paged ? tx.resourceEntry.count({ where }) : Promise.resolve(0)
      ]);
      return pageResult(paging, rows, total);
    });
  }

  @Post('entries')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD')
  create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createEntrySchema)) input: z.infer<typeof createEntrySchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const src = await tx.resourceSource.findUnique({ where: { id: input.sourceId }, select: { facilityId: true } });
      if (!src) throw new NotFoundException('Resource source not found.');
      if (!assertFacilityScope(user, src.facilityId)) throw new ForbiddenException('You are not assigned to this facility.');
      if (input.externalRefId) {
        const dup = await tx.resourceEntry.findFirst({ where: { organizationId: orgId, externalRefId: input.externalRefId } });
        if (dup) throw new ConflictException('An entry with this external reference already exists.');
      }
      const { data } = await buildEntry(tx, orgId, input);
      const entry = await tx.resourceEntry.create({
        data: { organizationId: orgId, status: 'DRAFT', submittedById: user.userId, ...data },
        include: { source: true, evidenceFiles: true }
      });
      if (input.evidenceFileId) await attachEvidence(tx, orgId, input.evidenceFileId, entry.id);
      await writeEntryHistory(tx, { organizationId: orgId, entryId: entry.id, actorId: user.userId, action: 'CREATED', toStatus: 'DRAFT' });
      return entry;
    });
  }

  @Patch('entries/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD')
  updateDraft(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(updateEntrySchema)) body: z.infer<typeof updateEntrySchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const prev = await loadEntryInScope(tx, user, id);
      if (prev.status !== 'DRAFT' && prev.status !== 'REJECTED') throw new ConflictException('Only draft or rejected entries can be edited.');
      if (body.version != null && body.version !== prev.version) throw new ConflictException('Someone else changed this entry. Reload it and try again.');
      const merged = {
        periodId: prev.periodId,
        sourceId: prev.sourceId,
        factorId: prev.factorId ?? undefined,
        dataBasis: body.dataBasis ?? prev.dataBasis,
        rawQuantity: body.rawQuantity ?? Number(prev.rawQuantity),
        rawUnit: body.rawUnit ?? prev.rawUnit,
        costInr: body.costInr ?? (prev.costInr != null ? Number(prev.costInr) : undefined),
        invoiceNumber: body.invoiceNumber ?? prev.invoiceNumber ?? undefined,
        billingStartDate: body.billingStartDate ?? prev.billingStartDate?.toISOString().slice(0, 10),
        billingEndDate: body.billingEndDate ?? prev.billingEndDate?.toISOString().slice(0, 10),
        calorificBasis: body.calorificBasis ?? prev.calorificBasis,
        openingStockQty: body.openingStockQty ?? (prev.openingStockQty != null ? Number(prev.openingStockQty) : undefined),
        purchasedQty: body.purchasedQty ?? (prev.purchasedQty != null ? Number(prev.purchasedQty) : undefined),
        closingStockQty: body.closingStockQty ?? (prev.closingStockQty != null ? Number(prev.closingStockQty) : undefined),
        nonEnergyDeductedQty: body.nonEnergyDeductedQty ?? (prev.nonEnergyDeductedQty != null ? Number(prev.nonEnergyDeductedQty) : undefined),
        labNcvOverride: body.labNcvOverride ?? (prev.labNcvOverride != null ? Number(prev.labNcvOverride) : undefined),
        labDensityOverride: body.labDensityOverride ?? (prev.labDensityOverride != null ? Number(prev.labDensityOverride) : undefined),
        grossGridImportKwh: body.grossGridImportKwh ?? (prev.grossGridImportKwh != null ? Number(prev.grossGridImportKwh) : undefined),
        onsiteSolarSelfConsumedKwh: body.onsiteSolarSelfConsumedKwh ?? (prev.onsiteSolarSelfConsumedKwh != null ? Number(prev.onsiteSolarSelfConsumedKwh) : undefined),
        solarExportedKwh: body.solarExportedKwh ?? (prev.solarExportedKwh != null ? Number(prev.solarExportedKwh) : undefined),
        estimationMethod: body.estimationMethod ?? prev.estimationMethod ?? undefined,
        refrigerantEquipmentId: body.refrigerantEquipmentId ?? prev.refrigerantEquipmentId ?? undefined,
        refrigerantMethod: body.refrigerantMethod ?? prev.refrigerantMethod ?? undefined,
        externalRefId: prev.externalRefId ?? undefined
      } as z.infer<typeof entryFieldsSchema>;
      if (body.factorId) merged.factorId = body.factorId;
      const { data } = await buildEntry(tx, orgId, merged, { excludeEntryId: id });
      const updated = await tx.resourceEntry.update({
        where: { id },
        data: { ...data, status: 'DRAFT', outlierConfirmed: false, outlierNote: null, version: { increment: 1 } }
      });
      if (body.evidenceFileId) await attachEvidence(tx, orgId, body.evidenceFileId, id);
      await writeEntryHistory(tx, { organizationId: orgId, entryId: id, actorId: user.userId, action: 'EDITED', fromStatus: prev.status, toStatus: 'DRAFT' });
      return updated;
    });
  }

  @Delete('entries/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD')
  discardDraft(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const prev = await loadEntryInScope(tx, user, id);
      if (prev.status !== 'DRAFT' && prev.status !== 'REJECTED') throw new ConflictException('Only draft or rejected entries can be withdrawn. Approved entries change through a period reopen.');
      await loadOpenPeriod(tx, prev.periodId);
      const updated = await tx.resourceEntry.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      await writeEntryHistory(tx, { organizationId: orgId, entryId: id, actorId: user.userId, action: 'WITHDRAWN', fromStatus: prev.status, toStatus: 'WITHDRAWN' });
      return updated;
    });
  }

  @Post('entries/:id/submit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(submitSchema)) body: z.infer<typeof submitSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const prev = await loadEntryInScope(tx, user, id);
      if (prev.status !== 'DRAFT' && prev.status !== 'REJECTED') throw new ConflictException(`This entry is ${prev.status.toLowerCase()} and cannot be submitted.`);
      await loadOpenPeriod(tx, prev.periodId);
      if (prev.reviewedById && prev.reviewedById === user.userId && !prev.isSelfReviewed) {
        throw new ConflictException('You sent this record back yourself, so you cannot send it for review again. Ask the person who entered it to correct it and send it.');
      }
      const flagged = anomalyFlags(prev.qualityFlags);
      let outlierConfirmed = prev.outlierConfirmed;
      let outlierNote = prev.outlierNote;
      if (flagged.length > 0 && !outlierConfirmed) {
        if (!body.outlierConfirmed || !body.outlierNote) {
          throw new BadRequestException(`This entry is flagged (${flagged.join(', ')}). Confirm it is genuine and explain why (at least 10 characters) before submitting.`);
        }
        outlierConfirmed = true;
        outlierNote = body.outlierNote;
      }
      const updated = await tx.resourceEntry.update({
        where: { id },
        data: { status: 'SUBMITTED', submittedById: user.userId, submittedAt: new Date(), outlierConfirmed, outlierNote }
      });
      await writeEntryHistory(tx, { organizationId: orgId, entryId: id, actorId: user.userId, action: 'SUBMITTED', fromStatus: prev.status, toStatus: 'SUBMITTED', diffJson: outlierConfirmed && flagged.length ? { outlierNote } : undefined });
      return updated;
    });
  }

  @Post('entries/:id/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(reviewSchema)) input: z.infer<typeof reviewSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const prev = await tx.resourceEntry.findUnique({ where: { id } });
      if (!prev) throw new NotFoundException('Entry not found.');
      if (prev.status !== 'SUBMITTED') throw new ConflictException(`Only submitted entries can be reviewed (this one is ${prev.status.toLowerCase()}).`);
      await loadOpenPeriod(tx, prev.periodId);
      if (input.decision === 'REJECTED' && (!input.reviewNote || input.reviewNote.length < 5)) throw new BadRequestException('Say what needs fixing when rejecting an entry (at least 5 characters).');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { allowSingleUserMode: true } });
      const isSelfReviewed = prev.submittedById === user.userId;
      if (isSelfReviewed && !org.allowSingleUserMode) throw new ForbiddenException('You submitted this entry, so someone else must review it (separation of duties).');
      if (input.decision === 'APPROVED' && anomalyFlags(prev.qualityFlags).length > 0 && !prev.outlierConfirmed) {
        throw new BadRequestException('This flagged entry has no explanation from the submitter. Send it back for one.');
      }
      const updated = await tx.resourceEntry.update({
        where: { id },
        data: {
          status: input.decision,
          reviewedById: user.userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
          isSelfReviewed,
          ...(input.decision === 'REJECTED' ? { rejectionCount: { increment: 1 } } : {})
        }
      });
      await writeEntryHistory(tx, { organizationId: orgId, entryId: id, actorId: user.userId, action: input.decision, fromStatus: prev.status, toStatus: input.decision, diffJson: { reviewNote: input.reviewNote, isSelfReviewed } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: input.decision === 'APPROVED' ? 'ENTRY_APPROVED' : 'ENTRY_REJECTED', resourceType: 'ResourceEntry', resourceId: id, metadata: { isSelfReviewed } });
      return updated;
    });
  }

  /** Which sources still have no data for the period, who owns them, and whether the deadline has passed. */
  private async outstanding(tx: any, orgId: string, periodId: string) {
    const period = await tx.reportingPeriod.findFirst({ where: { id: periodId, organizationId: orgId } });
    if (!period) throw new NotFoundException('Period not found.');
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { dataDueDays: true } });
    const dueAt = new Date(period.endDate.getTime() + org.dataDueDays * 86400000);
    const sources = await tx.resourceSource.findMany({
      where: { organizationId: orgId, effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }], facility: { approvalStatus: 'APPROVED' } },
      include: { facility: { select: { name: true } }, owner: { select: { id: true, fullName: true, email: true } } }
    });
    const have = await tx.resourceEntry.findMany({ where: { organizationId: orgId, periodId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } }, select: { sourceId: true } });
    const done = new Set(have.map((h: any) => h.sourceId));
    const missing = sources.filter((s: any) => !done.has(s.id));
    return { period, dueAt, overdue: new Date() > dueAt, missing };
  }

  @Get('periods/:id/outstanding')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  outstandingList(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    const scope = facilityScope(user);
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const o = await this.outstanding(tx, orgId, id);
      const rows = o.missing.filter((s: any) => !scope || scope.includes(s.facilityId));
      return { period: o.period.label, dueAt: o.dueAt, overdue: o.overdue, count: rows.length, sources: rows.map((s: any) => ({ sourceId: s.id, source: s.name, facility: s.facility.name, owner: s.owner?.fullName ?? null, ownerEmail: s.owner?.email ?? null })) };
    });
  }

  @Post('periods/:id/remind')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  remind(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const o = await this.outstanding(tx, orgId, id);
      if (!['OPEN', 'REOPENED'].includes(o.period.status)) throw new ConflictException(`${o.period.label} is closed.`);
      const byOwner = new Map<string, { email: string; name: string; items: string[] }>();
      for (const s of o.missing) {
        if (!s.owner) continue;
        const cur: { email: string; name: string; items: string[] } = byOwner.get(s.owner.id) ?? { email: s.owner.email, name: s.owner.fullName, items: [] };
        cur.items.push(`${s.name} (${s.facility.name})`);
        byOwner.set(s.owner.id, cur);
      }
      // One reminder per owner per period per day, so repeated clicks do not spam anyone.
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      let queued = 0;
      for (const [, v] of byOwner) {
        const recent = await tx.emailOutbox.findFirst({ where: { organizationId: orgId, toEmail: v.email, category: 'DATA_REMINDER', subject: { contains: o.period.label }, createdAt: { gte: since } } });
        if (recent) continue;
        await tx.emailOutbox.create({ data: { organizationId: orgId, toEmail: v.email, category: 'DATA_REMINDER', subject: `Data due for ${o.period.label}`, bodyText: `Hello ${v.name},\n\nPlease enter data for ${o.period.label} by ${o.dueAt.toISOString().slice(0, 10)}:\n- ${v.items.join('\n- ')}\n` } });
        queued++;
      }
      const unowned = o.missing.filter((s: any) => !s.owner).length;
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'DATA_REMINDERS_QUEUED', resourceType: 'ReportingPeriod', resourceId: id, metadata: { queued, unowned } });
      return { queued, owners: byOwner.size, sourcesWithoutOwner: unowned, overdue: o.overdue };
    });
  }

  @Post('periods/:id/close')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  closePeriod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const period = await loadOpenPeriod(tx, id);
      const readiness = await evaluatePeriodReadiness(tx, orgId, id);
      if (!readiness.readyToClose) throw new BadRequestException(`Cannot close ${period.label}: ${readiness.blockers.join('; ')}.`);
      return closeAndSnapshot(tx, orgId, user, period);
    });
  }
}

async function attachEvidence(tx: Tx, orgId: string, evidenceFileId: string, entryId: string) {
  const f = await tx.evidenceFile.findFirst({ where: { id: evidenceFileId, organizationId: orgId } });
  if (!f) throw new BadRequestException('Evidence file not found.');
  if (f.entryId && f.entryId !== entryId) throw new ConflictException('That file is already attached to a different entry.');
  await tx.evidenceFile.update({ where: { id: evidenceFileId }, data: { entryId } });
}

/** Builds the immutable snapshot and closes the period. Also used when a period is re-closed after reopening. */
export async function closeAndSnapshot(tx: Tx, orgId: string, user: AuthUser, period: { id: string; label: string }) {
  const id = period.id;
  const [entries, water, waste, scope3, allocations, latestSnap] = await Promise.all([
    tx.resourceEntry.findMany({ where: { periodId: id, status: 'APPROVED' }, include: { source: true, factor: { select: { isRenewable: true } } } }),
    tx.waterLog.findMany({ where: { periodId: id, status: 'APPROVED' } }),
    tx.wasteLog.findMany({ where: { periodId: id, status: 'APPROVED' } }),
    tx.scope3Purchase.findMany({ where: { periodId: id, status: 'APPROVED' } }),
    tx.scope2Allocation.findMany({ where: { periodId: id, isReversed: false }, include: { instrument: true } }),
    tx.periodSnapshot.findFirst({ where: { periodId: id }, orderBy: { version: 'desc' } })
  ]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const by = (scope: string) => entries.filter((e) => e.source.scope === scope);

  const s1 = sum(by('SCOPE_1').map((e) => Number(e.calculatedTco2eAr6)));
  const s2Location = sum(by('SCOPE_2').map((e) => Number(e.calculatedTco2eAr6)));
  const s3Entries = sum(by('SCOPE_3').map((e) => Number(e.calculatedTco2eAr6)));
  const s3Purchases = sum(scope3.map((p) => Number(p.calculatedTco2eAr6)));
  const bio = sum(entries.map((e) => Number(e.calculatedBiogenicCo2Kg) / 1000));
  const cctsAr2 = sum(entries.filter((e) => e.source.scope === 'SCOPE_1' || e.source.scope === 'SCOPE_2').map((e) => Number(e.calculatedTco2eAr2)));
  const energy = sum(entries.map((e) => Number(e.calculatedEnergyGj)));
  const renewable = sum(entries.map((e) => (e.factor?.isRenewable ? Number(e.calculatedEnergyGj) : 0) + Number(e.onsiteSolarSelfConsumedKwh ?? 0) * 0.0036));

  // Market-based Scope 2 (GHG Protocol Scope 2 Guidance): electricity covered by a quality-assured instrument
  // takes the instrument's emission rate instead of the grid rate. Only instruments that passed all quality checks count.
  const kwhByFacility = new Map<string, { kwh: number; tco2e: number }>();
  for (const e of by('SCOPE_2')) {
    if (e.normalizedUnit.toLowerCase() !== 'kwh') continue;
    const cur = kwhByFacility.get(e.source.facilityId) ?? { kwh: 0, tco2e: 0 };
    cur.kwh += Number(e.normalizedQuantity);
    cur.tco2e += Number(e.calculatedTco2eAr6);
    kwhByFacility.set(e.source.facilityId, cur);
  }
  let marketAdjustment = 0;
  const instrumentLines: { instrumentId: string; certificateRef: string; coveredKwh: number; reductionTco2e: number }[] = [];
  const usedByFacility = new Map<string, number>();
  for (const a of allocations) {
    if (!a.instrument.passesAllChecks) continue;
    const fac = kwhByFacility.get(a.instrument.facilityId);
    if (!fac || fac.kwh <= 0) continue;
    const already = usedByFacility.get(a.instrument.facilityId) ?? 0;
    const covered = Math.min(Number(a.allocatedMwh) * 1000, Math.max(0, fac.kwh - already)); // cannot cover more than was consumed
    usedByFacility.set(a.instrument.facilityId, already + covered);
    const gridRate = fac.tco2e / fac.kwh; // tCO2e per kWh actually used at this facility
    const instRate = Number(a.instrument.factorKgCo2ePerKwh) / 1000;
    const reduction = covered * (gridRate - instRate);
    marketAdjustment += reduction;
    instrumentLines.push({ instrumentId: a.instrumentId, certificateRef: a.instrument.certificateRef, coveredKwh: Number(covered.toFixed(3)), reductionTco2e: Number(reduction.toFixed(6)) });
  }
  const s2Market = Math.max(0, s2Location - marketAdjustment);

  const recovered = ['RECYCLED', 'REUSED', 'OTHER_RECOVERY'];
  const snapshot = await tx.periodSnapshot.create({
    data: {
      organizationId: orgId,
      periodId: id,
      version: (latestSnap?.version ?? 0) + 1,
      isRestatement: Boolean(latestSnap),
      scope1Ar6Tco2e: Number(s1.toFixed(4)),
      scope2LocationAr6Tco2e: Number(s2Location.toFixed(4)),
      scope2MarketAr6Tco2e: Number(s2Market.toFixed(4)),
      scope3Ar6Tco2e: Number((s3Entries + s3Purchases).toFixed(4)),
      biogenicCo2Tco2e: Number(bio.toFixed(4)),
      cctsScope1And2Ar2Tco2e: Number(cctsAr2.toFixed(4)),
      totalEnergyGj: Number(energy.toFixed(4)),
      renewableEnergyGj: Number(renewable.toFixed(4)),
      waterWithdrawalKl: sum(water.map((w) => Number(w.withdrawalKl))),
      waterConsumptionKl: sum(water.map((w) => Number(w.consumptionKl))),
      waterDischargeKl: sum(water.map((w) => Number(w.dischargeKl))),
      wasteGeneratedMt: sum(waste.map((w) => Number(w.quantityMt))),
      wasteRecoveredMt: sum(waste.filter((w) => recovered.includes(w.treatmentRoute)).map((w) => Number(w.quantityMt))),
      wasteDisposedMt: sum(waste.filter((w) => !recovered.includes(w.treatmentRoute)).map((w) => Number(w.quantityMt))),
      isSelfReviewedOnly: entries.length > 0 && entries.every((e) => e.isSelfReviewed),
      createdById: user.userId,
      snapshotPayload: { entryCount: entries.length, scope3PurchaseCount: scope3.length, closedBy: user.userId, marketBasedInstruments: instrumentLines }
    }
  });
  const updatedPeriod = await tx.reportingPeriod.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), closedById: user.userId } });
  await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'PERIOD_CLOSED', resourceType: 'ReportingPeriod', resourceId: id, metadata: { snapshotVersion: snapshot.version } });
  return { period: updatedPeriod, snapshot };
}
