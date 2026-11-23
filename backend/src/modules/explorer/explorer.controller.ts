import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, facilityScope } from '../../common/guards/roles.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

/** Group-by choices. The SQL for each is fixed here, so no client text ever reaches the query. */
const GROUPS: Record<string, { key: Prisma.Sql; label: Prisma.Sql; order: Prisma.Sql }> = {
  scope: { key: Prisma.sql`u.scope`, label: Prisma.sql`u.scope`, order: Prisma.sql`u.scope` },
  site: { key: Prisma.sql`COALESCE(u."facilityId", 'none')`, label: Prisma.sql`COALESCE(u."facilityName", 'Not tied to one site')`, order: Prisma.sql`COALESCE(u."facilityName", 'zzz')` },
  month: { key: Prisma.sql`u."periodId"`, label: Prisma.sql`u."periodLabel"`, order: Prisma.sql`u."periodStart"` },
  source: { key: Prisma.sql`u."sourceName"`, label: Prisma.sql`u."sourceName"`, order: Prisma.sql`u."sourceName"` },
  domain: { key: Prisma.sql`u.domain`, label: Prisma.sql`u.domain`, order: Prisma.sql`u.domain` }
};
const SCOPES = ['SCOPE_1', 'SCOPE_2', 'SCOPE_3', 'BIOGENIC', 'NON_GHG'];
const DOMAINS = ['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT', 'PURCHASED_GOODS_SERVICES'];
const STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

@ApiTags('Emissions explorer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('explorer')
export class ExplorerController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emissions, energy and spend grouped and filtered in the database (nothing is loaded into the app).
   * Defaults to APPROVED records only, the same basis as the month-end snapshot, so a closed month reconciles.
   */
  @Get()
  async explore(
    @CurrentUser() user: AuthUser,
    @Query('groupBy') groupBy = 'scope',
    @Query('financialYear') financialYear?: string,
    @Query('periodId') periodId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('scope') scope?: string,
    @Query('domain') domain?: string,
    @Query('status') status = 'APPROVED'
  ) {
    const g = GROUPS[groupBy];
    if (!g) throw new BadRequestException(`groupBy must be one of: ${Object.keys(GROUPS).join(', ')}.`);
    if (scope && !SCOPES.includes(scope)) throw new BadRequestException('Unknown scope.');
    if (domain && !DOMAINS.includes(domain)) throw new BadRequestException('Unknown domain.');
    if (!STATUSES.includes(status)) throw new BadRequestException('Unknown status.');
    if (financialYear && !/^FY\d{4}-\d{2}$/.test(financialYear)) throw new BadRequestException('financialYear looks like FY2026-27.');

    const orgId = user.organizationId!;
    const allowed = facilityScope(user); // plant managers only see their own sites
    const conds: Prisma.Sql[] = [];
    if (financialYear) conds.push(Prisma.sql`u."financialYear" = ${financialYear}`);
    if (periodId) conds.push(Prisma.sql`u."periodId" = ${periodId}`);
    if (facilityId) conds.push(Prisma.sql`u."facilityId" = ${facilityId}`);
    if (scope) conds.push(Prisma.sql`u.scope = ${scope}`);
    if (domain) conds.push(Prisma.sql`u.domain = ${domain}`);
    if (allowed) conds.push(Prisma.sql`u."facilityId" IN (${allowed.length ? Prisma.join(allowed) : Prisma.sql`NULL`})`);
    const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;

    return this.prisma.withTenantTx(orgId, async (tx) => {
      // RLS already limits both tables to this organisation; the explicit filter keeps the plan on the index.
      const base = Prisma.sql`
        WITH u AS (
          SELECT e."periodId", p.label AS "periodLabel", p."startDate" AS "periodStart", p."financialYear",
                 f.id AS "facilityId", f.name AS "facilityName", s.name AS "sourceName",
                 s.scope::text AS scope, s.domain::text AS domain, e.status::text AS status,
                 e."calculatedTco2eAr6"::float8 AS tco2e, e."calculatedEnergyGj"::float8 AS gj, COALESCE(e."costInr",0)::float8 AS cost
          FROM "ResourceEntry" e
          JOIN "ResourceSource" s ON s.id = e."sourceId"
          JOIN "Facility" f ON f.id = s."facilityId"
          JOIN "ReportingPeriod" p ON p.id = e."periodId"
          WHERE e."organizationId" = ${orgId} AND e.status::text = ${status}
          UNION ALL
          SELECT sp."periodId", p.label, p."startDate", p."financialYear",
                 NULL, NULL, COALESCE(sup.name, sp.description),
                 'SCOPE_3', 'PURCHASED_GOODS_SERVICES', sp.status::text,
                 sp."calculatedTco2eAr6"::float8, 0::float8, COALESCE(sp."spendInr",0)::float8
          FROM "Scope3Purchase" sp
          JOIN "ReportingPeriod" p ON p.id = sp."periodId"
          LEFT JOIN "Supplier" sup ON sup.id = sp."supplierId"
          WHERE sp."organizationId" = ${orgId} AND sp.status::text = ${status}
        )`;
      const rows = await tx.$queryRaw<any[]>(Prisma.sql`${base}
        SELECT ${g.key} AS key, ${g.label} AS label, SUM(u.tco2e)::float8 AS tco2e, SUM(u.gj)::float8 AS "energyGj", SUM(u.cost)::float8 AS "costInr", COUNT(*)::int AS records
        FROM u ${where} GROUP BY 1, 2 ORDER BY MIN(${g.order}), 2`);
      const tot = await tx.$queryRaw<any[]>(Prisma.sql`${base}
        SELECT COALESCE(SUM(u.tco2e),0)::float8 AS tco2e, COALESCE(SUM(u.gj),0)::float8 AS "energyGj", COALESCE(SUM(u.cost),0)::float8 AS "costInr", COUNT(*)::int AS records FROM u ${where}`);
      const r4 = (n: number) => Number(Number(n).toFixed(4));
      const t = tot[0];
      return {
        groupBy, status,
        filters: { financialYear: financialYear ?? null, periodId: periodId ?? null, facilityId: facilityId ?? null, scope: scope ?? null, domain: domain ?? null },
        total: { tco2e: r4(t.tco2e), energyGj: r4(t.energyGj), costInr: r4(t.costInr), records: t.records },
        groups: rows.map((r) => ({ key: r.key, label: r.label, tco2e: r4(r.tco2e), energyGj: r4(r.energyGj), costInr: r4(r.costInr), records: r.records, sharePct: t.tco2e ? Number(((r.tco2e / t.tco2e) * 100).toFixed(2)) : 0 }))
      };
    });
  }
}
