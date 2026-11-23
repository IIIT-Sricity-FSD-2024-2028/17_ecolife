import { ALL_MODULES } from '../../config/platform.constants';
import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import crypto from 'crypto';
import { z } from 'zod';
import { isValidGstin } from '../../common/utils/gstin.util';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, VerifiedEmailGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, assertFacilityScope, facilityScope } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sha256 } from '../../common/utils/crypto.util';
import { writeAuditLog } from '../../common/utils/audit.util';
import { evaluatePeriodReadiness } from '../../common/utils/verification-rules.util';
import { assertFactorUsable } from '../../common/utils/calculation.util';
import { lookupUnit } from '../../common/utils/units';
import { fyLabel, periodRow } from '../../common/utils/fiscal.util';

const createPeriodSchema = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });
const createFySchema = z.object({ startYear: z.number().int().min(2000).max(2100) });

const createSourceSchema = z.object({
  facilityId: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().min(2).max(160),
  domain: z.enum(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT']),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3', 'BIOGENIC', 'NON_GHG']),
  canonicalUnit: z.string().min(1),
  defaultFactorId: z.string().optional(),
  meterSerialNo: z.string().optional()
});

const updateOrgSchema = z.object({
  preset: z.enum(['SME_STANDARD', 'MID_MARKET', 'ENTERPRISE_BRSR']).optional(),
  enabledModules: z.array(z.enum(ALL_MODULES)).max(ALL_MODULES.length).optional(),
  allowSingleUserMode: z.boolean().optional(),
  cctsObligated: z.boolean().optional(),
  assuranceStandard: z.enum(['INTERNAL_TRACKING', 'SEBI_ISF_ASSESSMENT', 'ICAI_SSAE_3000', 'ICAI_SSAE_3410', 'ISO_14064_3', 'ISSA_5000', 'BEE_CCTS_ACVA']).optional()
});

const createApiKeySchema = z.object({
  name: z.string().min(2).max(120),
  facilityIds: z.array(z.string()).default([]),
  scopes: z.array(z.enum(['ingest:entries'])).min(1).default(['ingest:entries']),
  expiresInDays: z.number().int().min(1).max(730).optional()
});

const orgProfileSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  cin: z.string().trim().toUpperCase().regex(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, 'A CIN has 21 characters, e.g. U29100MH2005PTC123456').optional(),
  gstin: z.string().trim().toUpperCase().refine(isValidGstin, 'This is not a valid GSTIN (15 characters, state code and check character are verified).').optional(),
  industrySector: z.string().trim().min(2).max(120).optional(),
  billingEmail: z.string().trim().toLowerCase().email().optional(),
  billingAddress: z.string().trim().min(10).max(500).optional()
}).refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.');

@ApiTags('Workspace & Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller()
export class WorkspaceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      // Totals are summed by the database, never by loading records into the server, so this stays fast at any size.
      const [org, facilities, periods, snapshotsCount, targetCount, creditSum, pendingCount, flagged, byPeriod, byFacility, totals] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: orgId }, include: { plan: true } }),
        tx.facility.findMany({ where: { organizationId: orgId }, take: LEGACY_CAP }),
        tx.reportingPeriod.findMany({ where: { organizationId: orgId }, orderBy: { startDate: 'asc' }, take: LEGACY_CAP }),
        tx.periodSnapshot.count({ where: { organizationId: orgId } }),
        tx.target.count({ where: { organizationId: orgId } }),
        tx.greenEconomyCredit.aggregate({ where: { organizationId: orgId }, _sum: { quantity: true } }),
        tx.resourceEntry.count({ where: { organizationId: orgId, status: 'SUBMITTED' } }),
        tx.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "ResourceEntry" WHERE "organizationId" = ${orgId} AND status = 'APPROVED' AND jsonb_array_length(COALESCE("qualityFlags", '[]'::jsonb)) > 0`,
        tx.$queryRaw<any[]>`SELECT e."periodId" AS id,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_1'), 0) AS s1,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_2'), 0) AS s2,
            COALESCE(SUM(e."costInr"), 0) AS cost
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' GROUP BY e."periodId"`,
        tx.$queryRaw<any[]>`SELECT s."facilityId" AS id, COALESCE(SUM(e."calculatedTco2eAr6"), 0) AS tco2e, COALESCE(SUM(e."costInr"), 0) AS cost
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' GROUP BY s."facilityId"`,
        tx.$queryRaw<any[]>`SELECT
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_1'), 0) AS s1,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_2'), 0) AS s2,
            COALESCE(SUM(e."calculatedBiogenicCo2Kg"), 0) / 1000 AS biogenic,
            COALESCE(SUM(e."calculatedEnergyGj"), 0) AS energy,
            COALESCE(SUM(e."costInr"), 0) AS cost
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED'`
      ]);
      const t = totals[0] ?? {};
      const pMap = new Map(byPeriod.map((r) => [r.id, r]));
      const fMap = new Map(byFacility.map((r) => [r.id, r]));
      const n2 = (v: any) => Number(Number(v ?? 0).toFixed(2));

      const monthlyTrend = periods.map((p) => {
        const r = pMap.get(p.id);
        return { periodId: p.id, label: p.label, status: p.status, scope1: n2(r?.s1), scope2: n2(r?.s2), costInr: Math.round(Number(r?.cost ?? 0)) };
      });
      const facilityBreakdown = facilities.map((f) => {
        const r = fMap.get(f.id);
        return { id: f.id, name: f.name, city: f.city, state: f.state, tco2e: n2(r?.tco2e), costInr: Math.round(Number(r?.cost ?? 0)) };
      });

      return {
        organization: org,
        basis: 'APPROVED',
        kpis: {
          totalScope1Tco2e: n2(t.s1),
          totalScope2Tco2e: n2(t.s2),
          totalScope1And2Tco2e: n2(Number(t.s1 ?? 0) + Number(t.s2 ?? 0)),
          biogenicCo2Tco2e: n2(t.biogenic),
          totalEnergyGj: n2(t.energy),
          totalSpendInr: Math.round(Number(t.cost ?? 0)),
          pendingApprovals: pendingCount,
          flaggedAnomalies: Number(flagged[0]?.n ?? 0),
          activeTargetsCount: targetCount,
          nonNettedCreditsQty: Number(creditSum._sum.quantity ?? 0)
        },
        monthlyTrend,
        facilityBreakdown,
        snapshotsCount
      };
    });
  }

  @Get('periods')
  periods(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.reportingPeriod.findMany({ take: LEGACY_CAP, where: { organizationId: user.organizationId! }, orderBy: { startDate: 'desc' } })
    );
  }

  @Post('periods')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD')
  createPeriod(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createPeriodSchema)) input: z.infer<typeof createPeriodSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { fyStartMonth: true } });
      const now = new Date();
      const ahead = (input.year - now.getUTCFullYear()) * 12 + (input.month - (now.getUTCMonth() + 1));
      if (ahead > 1) throw new BadRequestException('You can open a period at most one month ahead.');
      const row = periodRow(orgId, input.year, input.month, org.fyStartMonth);
      const exists = await tx.reportingPeriod.findFirst({ where: { financialYear: row.financialYear, month: row.month } });
      if (exists) throw new ConflictException(`${row.label} already exists.`);
      const created = await tx.reportingPeriod.create({ data: row });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'PERIOD_CREATED', resourceType: 'ReportingPeriod', resourceId: created.id, metadata: { label: row.label } });
      return created;
    });
  }

  /** Opens all 12 months of a financial year at once (existing months are left alone). */
  @Post('periods/financial-year')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD')
  createFinancialYear(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createFySchema)) input: z.infer<typeof createFySchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { fyStartMonth: true } });
      const created: string[] = [];
      for (let i = 0; i < 12; i++) {
        const m0 = org.fyStartMonth - 1 + i;
        const year = input.startYear + Math.floor(m0 / 12);
        const month = (m0 % 12) + 1;
        const row = periodRow(orgId, year, month, org.fyStartMonth);
        const exists = await tx.reportingPeriod.findFirst({ where: { financialYear: row.financialYear, month: row.month } });
        if (!exists) {
          await tx.reportingPeriod.create({ data: row });
          created.push(row.label);
        }
      }
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'FINANCIAL_YEAR_OPENED', resourceType: 'ReportingPeriod', metadata: { startYear: input.startYear, created } });
      return { financialYear: fyLabel(input.startYear, org.fyStartMonth), created };
    });
  }

  @Get('periods/:id/readiness')
  readiness(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      evaluatePeriodReadiness(tx, user.organizationId!, id)
    );
  }

  @Get('facilities')
  facilities(@CurrentUser() user: AuthUser) {
    const scope = facilityScope(user); // a plant manager sees only their own sites
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.facility.findMany({ take: LEGACY_CAP, where: { organizationId: user.organizationId!, ...(scope ? { id: { in: scope } } : {}) }, orderBy: { name: 'asc' } })
    );
  }

  /** Without paging: the full list (capped). With page/pageSize: paged; ?facilityId, ?domain and ?q narrow it. */
  @Get('sources')
  async sources(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const scope = facilityScope(user);
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = {
      organizationId: user.organizationId!,
      ...(q.domain ? { domain: q.domain } : {}),
      ...(scope ? { facilityId: q.facilityId ? (scope.includes(q.facilityId) ? q.facilityId : { in: [] }) : { in: scope } } : (q.facilityId ? { facilityId: q.facilityId } : {})),
      ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { meterSerialNo: { contains: term, mode: 'insensitive' } }] } : {})
    };
    const include = { facility: { select: { id: true, name: true, city: true, state: true } }, defaultFactor: true, owner: { select: { id: true, fullName: true } } };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paged) return tx.resourceSource.findMany({ take: LEGACY_CAP, where, include, orderBy: { name: 'asc' } });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.resourceSource.findMany({ where, include, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.resourceSource.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  @Post('sources')
  @Roles('SUSTAINABILITY_LEAD', 'PLANT_MANAGER')
  createSource(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createSourceSchema)) input: z.infer<typeof createSourceSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const facility = await tx.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } });
      if (!facility) throw new BadRequestException('Facility not found in your organization.');
      if (!assertFacilityScope(user, facility.id)) throw new ForbiddenException('You are not assigned to this facility.');
      lookupUnit(input.canonicalUnit); // rejects units the calculation engine cannot convert
      const { effectiveFrom, ...rest } = input;
      if (rest.defaultFactorId) {
        const f = await tx.emissionFactor.findFirst({ where: { id: rest.defaultFactorId, OR: [{ organizationId: null }, { organizationId: orgId }] } });
        if (!f) throw new BadRequestException('Default factor not found.');
        assertFactorUsable(f, { domain: rest.domain, scope: rest.scope });
      }
      let from: Date;
      if (effectiveFrom) from = new Date(effectiveFrom + 'T00:00:00Z');
      else {
        // Default: the start of the earliest open period, so the source can take entries for everything still open.
        const earliest = await tx.reportingPeriod.findFirst({ where: { status: { in: ['OPEN', 'REOPENED'] } }, orderBy: { startDate: 'asc' } });
        const now = new Date();
        from = earliest?.startDate ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      }
      const src = await tx.resourceSource.create({ data: { organizationId: orgId, ...rest, ownerId: user.userId, effectiveFrom: from } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SOURCE_CREATED', resourceType: 'ResourceSource', resourceId: src.id, metadata: { name: src.name } });
      return src;
    });
  }

  /** Factors you can use: the official library plus your own. Paged with ?q, ?domain, ?status. */
  @Get('factors')
  async factors(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = {
      OR: [{ organizationId: null }, { organizationId: user.organizationId! }],
      ...(q.domain ? { domain: q.domain } : {}), ...(q.status ? { status: q.status } : {}),
      ...(term ? { AND: [{ OR: [{ code: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }, { sourceAuthority: { contains: term, mode: 'insensitive' } }] }] } : {})
    };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paged) return tx.emissionFactor.findMany({ take: LEGACY_CAP, where, orderBy: { code: 'asc' } });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.emissionFactor.findMany({ where, orderBy: [{ code: 'asc' }, { validFrom: 'desc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.emissionFactor.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  @Patch('org/settings')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  updateSettings(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(updateOrgSchema)) input: z.infer<typeof updateOrgSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const updated = await tx.organization.update({ where: { id: orgId }, data: input });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ORG_SETTINGS_UPDATED', resourceType: 'Organization', resourceId: orgId, metadata: input });
      return updated;
    });
  }

  @Get('org/profile')
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD')
  orgProfile(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.organization.findUniqueOrThrow({ where: { id: user.organizationId! }, select: { id: true, name: true, cin: true, gstin: true, industrySector: true, billingEmail: true, billingAddress: true, fyStartMonth: true, status: true, trialEndsAt: true } })
    );
  }

  @Patch('org/profile')
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER')
  updateOrgProfile(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(orgProfileSchema)) input: z.infer<typeof orgProfileSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const updated = await tx.organization.update({ where: { id: orgId }, data: input, select: { id: true, name: true, cin: true, gstin: true, industrySector: true, billingEmail: true, billingAddress: true } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ORG_PROFILE_UPDATED', resourceType: 'Organization', resourceId: orgId, metadata: { fields: Object.keys(input) } });
      return updated;
    });
  }

  @Get('org/api-keys')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD')
  listApiKeys(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.apiKey.findMany({ take: LEGACY_CAP,
        where: { organizationId: user.organizationId! },
        select: { id: true, name: true, keyPrefix: true, facilityIds: true, scopes: true, isActive: true, expiresAt: true, lastUsedAt: true, createdAt: true, revokedAt: true },
        orderBy: { createdAt: 'desc' }
      })
    );
  }

  @Post('org/api-keys')
  @Roles('ORG_ADMIN')
  @UseGuards(VerifiedEmailGuard)
  createApiKey(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createApiKeySchema)) input: z.infer<typeof createApiKeySchema>) {
    const orgId = user.organizationId!;
    const rawKey = `trp_live_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (input.facilityIds.length > 0) {
        const n = await tx.facility.count({ where: { id: { in: input.facilityIds }, organizationId: orgId } });
        if (n !== new Set(input.facilityIds).size) throw new BadRequestException('One or more facilities do not belong to your organization.');
      }
      const key = await tx.apiKey.create({
        data: {
          organizationId: orgId,
          name: input.name,
          keyPrefix: rawKey.slice(0, 14),
          keyHash: sha256(rawKey),
          facilityIds: input.facilityIds,
          scopes: input.scopes,
          // Keys rotate: expire after a year unless the admin picks a shorter life.
          expiresAt: new Date(Date.now() + (input.expiresInDays ?? 365) * 24 * 60 * 60 * 1000),
          createdById: user.userId
        },
        select: { id: true, name: true, keyPrefix: true, facilityIds: true, scopes: true, isActive: true, expiresAt: true, createdAt: true }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'API_KEY_CREATED', resourceType: 'ApiKey', resourceId: key.id, metadata: { name: input.name, facilityIds: input.facilityIds } });
      return { apiKey: key, rawKey };
    });
  }

  @Delete('org/api-keys/:id')
  @Roles('ORG_ADMIN')
  revokeApiKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.apiKey.updateMany({
        where: { id, organizationId: orgId },
        data: { isActive: false, revokedById: user.userId, revokedAt: new Date() }
      });
      if (r.count === 0) throw new NotFoundException('API key not found.');
      const updated = { id, isActive: false };
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'API_KEY_REVOKED', resourceType: 'ApiKey', resourceId: id });
      return updated;
    });
  }
}
