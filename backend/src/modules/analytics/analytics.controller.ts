import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, facilityScope } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

const n = (v: any, d = 2) => Number(Number(v ?? 0).toFixed(d));

/**
 * Numbers behind the role dashboards. Every figure is summed by the database and the answers stay small
 * (one row per month, per site, per status), so the cost does not grow with the number of records.
 * Emissions use APPROVED records only, the same basis as the month-end close.
 */
@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  private siteFilter(user: AuthUser, col: Prisma.Sql) {
    const allowed = facilityScope(user);
    return allowed ? Prisma.sql`AND ${col} IN (${allowed.length ? Prisma.join(allowed) : Prisma.sql`NULL`})` : Prisma.empty;
  }

  /** Emissions by month and scope (with the same month a year earlier), by site, by kind of source, and per rupee spent. */
  @Get('emissions')
  async emissions(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    const site = this.siteFilter(user, Prisma.sql`s."facilityId"`);
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [monthly, scope3, bySite, byDomain, bySource, scopeTotals] = await Promise.all([
        tx.$queryRaw<any[]>(Prisma.sql`SELECT p.id, p.label, p."startDate" AS start, p.status::text AS status,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_1'), 0)::float8 AS s1,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_2'), 0)::float8 AS s2,
            COALESCE(SUM(e."costInr"), 0)::float8 AS cost,
            COALESCE(SUM(e."calculatedEnergyGj"), 0)::float8 AS gj
          FROM "ReportingPeriod" p
          LEFT JOIN "ResourceEntry" e ON e."periodId" = p.id AND e.status = 'APPROVED'
          LEFT JOIN "ResourceSource" s ON s.id = e."sourceId" ${site}
          WHERE p."organizationId" = ${orgId} GROUP BY p.id ORDER BY p."startDate"`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT "periodId" AS id, COALESCE(SUM("calculatedTco2eAr6"),0)::float8 AS s3
          FROM "Scope3Purchase" WHERE "organizationId" = ${orgId} AND status = 'APPROVED' GROUP BY "periodId"`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT f.id, f.name, f.city,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_1'), 0)::float8 AS s1,
            COALESCE(SUM(e."calculatedTco2eAr6") FILTER (WHERE s.scope = 'SCOPE_2'), 0)::float8 AS s2
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" JOIN "Facility" f ON f.id = s."facilityId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' ${site} GROUP BY f.id ORDER BY SUM(e."calculatedTco2eAr6") DESC LIMIT 12`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT s.domain::text AS key, COALESCE(SUM(e."calculatedTco2eAr6"),0)::float8 AS tco2e
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' ${site} GROUP BY 1 ORDER BY 2 DESC`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT s.domain::text AS domain, s."fuelCategory"::text AS "fuelCategory", s.scope::text AS scope, COALESCE(SUM(e."calculatedTco2eAr6"),0)::float8 AS tco2e
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' ${site} GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 10`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT s.scope::text AS key, COALESCE(SUM(e."calculatedTco2eAr6"),0)::float8 AS tco2e
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' ${site} GROUP BY 1`)
      ]);
      const s3 = new Map(scope3.map((r) => [r.id, r.s3]));
      const withScope3 = !facilityScope(user);
      const rows = monthly.map((m) => ({ periodId: m.id, label: m.label, start: m.start, status: m.status, scope1: n(m.s1), scope2: n(m.s2), scope3: withScope3 ? n(s3.get(m.id)) : 0, costInr: Math.round(m.cost), energyGj: n(m.gj) }));
      // Same month, one year earlier (the series is monthly, so it is 12 steps back).
      const withPrev = rows.map((r, i) => {
        const prev = rows[i - 12];
        const total = r.scope1 + r.scope2;
        return { ...r, total: n(total), prevYearTotal: prev ? n(prev.scope1 + prev.scope2) : null,
          intensityTco2ePerLakh: r.costInr > 0 ? n(total / (r.costInr / 100000), 3) : null };
      });
      return {
        basis: 'APPROVED',
        monthly: withPrev,
        scopeTotals: Object.fromEntries(scopeTotals.map((r) => [r.key, n(r.tco2e)])),
        bySite: bySite.map((r) => ({ id: r.id, name: r.name, city: r.city, scope1: n(r.s1), scope2: n(r.s2) })),
        byDomain: byDomain.map((r) => ({ key: r.key, tco2e: n(r.tco2e) })),
        bySource: bySource.map((r) => ({ domain: r.domain, fuelCategory: r.fuelCategory, scope: r.scope, tco2e: n(r.tco2e) }))
      };
    });
  }

  /** Where records are in the review flow, how long the waiting ones have waited, and each site's progress this month. */
  @Get('workflow')
  async workflow(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    const site = this.siteFilter(user, Prisma.sql`s."facilityId"`);
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [byStatus, aging, perMonth, perSite, rejected, waiting] = await Promise.all([
        tx.$queryRaw<any[]>(Prisma.sql`SELECT e.status::text AS key, COUNT(*)::int AS n FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
          WHERE e."organizationId" = ${orgId} AND e.status <> 'WITHDRAWN' ${site} GROUP BY 1`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT CASE WHEN age < 2 THEN 'lt2' WHEN age < 7 THEN 'd2to7' WHEN age < 14 THEN 'd7to14' ELSE 'gt14' END AS bucket, COUNT(*)::int AS n
          FROM (SELECT EXTRACT(EPOCH FROM (now() - COALESCE(e."submittedAt", e."updatedAt"))) / 86400 AS age FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId"
                WHERE e."organizationId" = ${orgId} AND e.status = 'SUBMITTED' ${site}) a GROUP BY 1`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT p.label, p."startDate" AS start,
            COUNT(*) FILTER (WHERE e.status = 'DRAFT')::int AS draft, COUNT(*) FILTER (WHERE e.status = 'SUBMITTED')::int AS submitted,
            COUNT(*) FILTER (WHERE e.status = 'APPROVED')::int AS approved, COUNT(*) FILTER (WHERE e.status = 'REJECTED')::int AS rejected
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" JOIN "ReportingPeriod" p ON p.id = e."periodId"
          WHERE e."organizationId" = ${orgId} AND e.status <> 'WITHDRAWN' ${site} GROUP BY p.id ORDER BY p."startDate" DESC LIMIT 12`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT f.id, f.name,
            COUNT(DISTINCT s.id)::int AS sources,
            COUNT(DISTINCT s.id) FILTER (WHERE EXISTS (SELECT 1 FROM "ResourceEntry" x WHERE x."sourceId" = s.id AND x."periodId" = (SELECT id FROM "ReportingPeriod" WHERE "organizationId" = ${orgId} AND status IN ('OPEN','REOPENED') AND "startDate" <= now() ORDER BY "startDate" DESC LIMIT 1) AND x.status IN ('SUBMITTED','APPROVED')))::int AS done
          FROM "Facility" f JOIN "ResourceSource" s ON s."facilityId" = f.id AND (s."effectiveTo" IS NULL OR s."effectiveTo" > now())
          WHERE f."organizationId" = ${orgId} ${this.siteFilter(user, Prisma.sql`f.id`)} GROUP BY f.id ORDER BY f.name LIMIT 40`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT COUNT(*)::int AS n FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" WHERE e."organizationId" = ${orgId} AND e.status = 'REJECTED' ${site}`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT e.id, e.status::text AS status, s.name AS source, f.name AS site, p.label AS period, e."calculatedTco2eAr6"::float8 AS tco2e,
            COALESCE(e."submittedAt", e."updatedAt") AS at, u."fullName" AS "by", e."reviewNote" AS note
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" JOIN "Facility" f ON f.id = s."facilityId" JOIN "ReportingPeriod" p ON p.id = e."periodId"
          LEFT JOIN "User" u ON u.id = e."submittedById"
          WHERE e."organizationId" = ${orgId} AND e.status IN ('SUBMITTED','REJECTED') ${site} ORDER BY (e.status = 'REJECTED') DESC, COALESCE(e."submittedAt", e."updatedAt") ASC LIMIT 8`)
      ]);
      return {
        byStatus: Object.fromEntries(byStatus.map((r) => [r.key, r.n])),
        aging: Object.fromEntries(aging.map((r) => [r.bucket, r.n])),
        perMonth: perMonth.reverse().map((r) => ({ label: r.label, start: r.start, draft: r.draft, submitted: r.submitted, approved: r.approved, rejected: r.rejected })),
        perSite, rejected: rejected[0]?.n ?? 0,
        waiting: waiting.map((w) => ({ id: w.id, status: w.status, source: w.source, site: w.site, period: w.period, tco2e: n(w.tco2e), at: w.at, by: w.by, note: w.note }))
      };
    });
  }

  /** Each target: where it started, where it has to get to, the actual figure for each year so far, and the status of its actions. */
  @Get('targets')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'FINANCE_MANAGER', 'INTERNAL_AUDITOR', 'ORG_ADMIN')
  async targets(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [targets, actions, byLever] = await Promise.all([
        tx.target.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, take: 50, include: { milestones: { orderBy: { financialYear: 'asc' } } } }),
        tx.reductionAction.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true }, _sum: { netExpectedSavingTco2e: true, achievedSavingTco2e: true } }),
        tx.reductionAction.findMany({ where: { organizationId: orgId, status: { not: 'CANCELLED' } }, orderBy: { netExpectedSavingTco2e: 'desc' }, take: 12,
          select: { id: true, title: true, lever: true, status: true, netExpectedSavingTco2e: true, achievedSavingTco2e: true, macInrPerTco2e: true, capexInr: true } })
      ]);
      return {
        targets: targets.map((t) => ({
          id: t.id, name: t.name, type: t.targetType, framework: t.framework, status: t.status, baseYear: t.baseYear, targetYear: t.targetYear,
          baseValue: n(t.baseValue), targetValue: n(t.targetValue), reductionPct: n(t.targetReductionPct), intensityUnit: t.intensityUnit,
          milestones: t.milestones.map((m) => ({ financialYear: m.financialYear, planned: n(m.plannedValue), actual: m.actualValue == null ? null : n(m.actualValue), status: m.status }))
        })),
        actionsByStatus: Object.fromEntries(actions.map((a) => [a.status, { count: a._count._all, expectedTco2e: n(a._sum.netExpectedSavingTco2e), achievedTco2e: n(a._sum.achievedSavingTco2e) }])),
        topActions: byLever.map((a) => ({ id: a.id, title: a.title, lever: a.lever, status: a.status, expectedTco2e: n(a.netExpectedSavingTco2e), achievedTco2e: a.achievedSavingTco2e == null ? null : n(a.achievedSavingTco2e),
          macInrPerTco2e: a.macInrPerTco2e == null ? null : Math.round(Number(a.macInrPerTco2e)), capexInr: a.capexInr == null ? null : Math.round(Number(a.capexInr)) }))
      };
    });
  }

  /** Spend against emissions, cost of each tonne by site, certificate use, and invoices by month. */
  @Get('finance')
  @Roles('FINANCE_MANAGER', 'EXECUTIVE_APPROVER', 'ORG_ADMIN', 'SUSTAINABILITY_LEAD')
  async finance(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [bySite, byDomain, instruments, invoices, recentInvoices] = await Promise.all([
        tx.$queryRaw<any[]>(Prisma.sql`SELECT f.id, f.name, COALESCE(SUM(e."costInr"),0)::float8 AS cost, COALESCE(SUM(e."calculatedTco2eAr6"),0)::float8 AS tco2e
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" JOIN "Facility" f ON f.id = s."facilityId"
          WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' GROUP BY f.id ORDER BY 3 DESC LIMIT 12`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT s.domain::text AS key, COALESCE(SUM(e."costInr"),0)::float8 AS cost
          FROM "ResourceEntry" e JOIN "ResourceSource" s ON s.id = e."sourceId" WHERE e."organizationId" = ${orgId} AND e.status = 'APPROVED' GROUP BY 1 ORDER BY 2 DESC`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT "instrumentType" AS type, COUNT(*)::int AS n, COALESCE(SUM("totalMwh"),0)::float8 AS total, COALESCE(SUM("remainingMwh"),0)::float8 AS remaining,
            COUNT(*) FILTER (WHERE "validTo" < now() + interval '60 days')::int AS expiring FROM "Scope2Instrument" WHERE "organizationId" = ${orgId} GROUP BY 1`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(date_trunc('month', "issuedAt"), 'Mon YY') AS label, date_trunc('month', "issuedAt") AS start,
            COALESCE(SUM("totalInr") FILTER (WHERE status = 'PAID'),0)::float8 AS paid, COALESCE(SUM("totalInr") FILTER (WHERE status <> 'PAID'),0)::float8 AS open
          FROM "Invoice" WHERE "organizationId" = ${orgId} GROUP BY 1, 2 ORDER BY 2 DESC LIMIT 12`),
        tx.invoice.findMany({ where: { organizationId: orgId }, orderBy: { issuedAt: 'desc' }, take: 6, select: { id: true, invoiceNumber: true, issuedAt: true, dueAt: true, totalInr: true, status: true, planName: true } })
      ]);
      return {
        bySite: bySite.map((r) => ({ id: r.id, name: r.name, costInr: Math.round(r.cost), tco2e: n(r.tco2e), inrPerTco2e: r.tco2e > 0 ? Math.round(r.cost / r.tco2e) : null })),
        byDomain: byDomain.map((r) => ({ key: r.key, costInr: Math.round(r.cost) })),
        instruments: instruments.map((r) => ({ type: r.type, count: r.n, totalMwh: n(r.total), remainingMwh: n(r.remaining), expiringSoon: r.expiring })),
        invoices: invoices.reverse().map((r) => ({ label: r.label, paidInr: Math.round(r.paid), openInr: Math.round(r.open) })),
        recentInvoices: recentInvoices.map((i) => ({ id: i.id, number: i.invoiceNumber, issuedAt: i.issuedAt, dueAt: i.dueAt, totalInr: Math.round(Number(i.totalInr)), status: i.status, plan: i.planName }))
      };
    });
  }

  /** Findings by severity and state, who has done what lately, and the status of each assurance engagement. */
  @Get('assurance')
  @Roles('INTERNAL_AUDITOR', 'EXTERNAL_VERIFIER', 'EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD', 'ORG_ADMIN')
  async assurance(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    const verifierOnly = user.roles?.length > 0 && user.roles.every((r: string) => r === 'EXTERNAL_VERIFIER');
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [verification, internal, activity, engagements, topActions, recentInternal, openQuestions] = await Promise.all([
        tx.$queryRaw<any[]>(Prisma.sql`SELECT severity::text AS severity, status::text AS status, COUNT(*)::int AS n FROM "VerificationFinding" WHERE "organizationId" = ${orgId} GROUP BY 1, 2`),
        tx.internalAuditFinding.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
        verifierOnly ? Promise.resolve([]) : tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(d, 'DD Mon') AS label, d AS day, COALESCE(c.n, 0)::int AS n
          FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
          LEFT JOIN (SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n FROM "AuditLog" WHERE "organizationId" = ${orgId} AND "createdAt" > now() - interval '30 days' GROUP BY 1) c ON c.day = d ORDER BY d`),
        tx.assuranceEngagement.groupBy({ by: ['status'], where: { organizationId: orgId }, _count: { _all: true } }),
        verifierOnly ? Promise.resolve([]) : tx.$queryRaw<any[]>(Prisma.sql`SELECT action AS key, COUNT(*)::int AS n FROM "AuditLog" WHERE "organizationId" = ${orgId} AND "createdAt" > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
        verifierOnly ? Promise.resolve([]) : tx.internalAuditFinding.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, controlDomain: true, status: true, summary: true, createdAt: true } }),
        tx.verificationFinding.findMany({ where: { organizationId: orgId, status: { in: ['OPEN', 'RESPONDED'] } }, orderBy: { createdAt: 'asc' }, take: 6, select: { id: true, severity: true, status: true, questionText: true, createdAt: true } })
      ]);
      return {
        recentInternal: (recentInternal as any[]).map((r) => ({ id: r.id, domain: r.controlDomain, status: r.status, summary: r.summary, createdAt: r.createdAt })),
        openQuestions: openQuestions.map((r) => ({ id: r.id, severity: r.severity, status: r.status, text: r.questionText, createdAt: r.createdAt })),
        verification: verification.map((r) => ({ severity: r.severity, status: r.status, count: r.n })),
        internal: verifierOnly ? {} : Object.fromEntries(internal.map((r) => [r.status, r._count._all])),
        activity: activity.map((r: any) => ({ label: r.label, day: r.day, count: r.n })),
        engagements: Object.fromEntries(engagements.map((r) => [r.status, r._count._all])),
        topActions: topActions.map((r: any) => ({ key: r.key, count: r.n }))
      };
    });
  }

  /** People, roles, seats and sites against the plan, and recent sign-in and activity volume. */
  @Get('admin')
  @Roles('ORG_ADMIN')
  async admin(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [org, roles, active, sites, invites, logins, mfa, pendingList, recentPeople] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: orgId }, include: { plan: true } }),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT ur.role::text AS key, COUNT(DISTINCT ur."userId")::int AS n FROM "UserRole" ur JOIN "User" u ON u.id = ur."userId" WHERE ur."organizationId" = ${orgId} AND u."isActive" GROUP BY 1 ORDER BY 2 DESC`),
        tx.user.count({ where: { organizationId: orgId, isActive: true } }),
        tx.facility.count({ where: { organizationId: orgId } }),
        tx.invitation.count({ where: { organizationId: orgId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(d, 'DD Mon') AS label, COALESCE(c.n, 0)::int AS n
          FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
          LEFT JOIN (SELECT date_trunc('day', s."createdAt") AS day, COUNT(*) AS n FROM "UserSession" s JOIN "User" u ON u.id = s."userId"
                     WHERE u."organizationId" = ${orgId} AND s."createdAt" > now() - interval '14 days' GROUP BY 1) c ON c.day = d ORDER BY d`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT COUNT(*) FILTER (WHERE "twoFactorEnabled")::int AS on_, COUNT(*)::int AS total FROM "User" WHERE "organizationId" = ${orgId} AND "isActive"`),
        tx.invitation.findMany({ where: { organizationId: orgId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, email: true, roles: true, expiresAt: true } }),
        tx.user.findMany({ where: { organizationId: orgId, isActive: true }, orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }], take: 6, select: { id: true, fullName: true, email: true, lastLoginAt: true, twoFactorEnabled: true } })
      ]);
      return {
        plan: { name: org.plan.name, maxUsers: org.plan.maxUsers, maxFacilities: org.plan.maxFacilities },
        users: { active, pendingInvites: invites, max: org.plan.maxUsers },
        sites: { used: sites, max: org.plan.maxFacilities },
        byRole: roles.map((r) => ({ key: r.key, count: r.n })),
        logins: logins.map((r) => ({ label: r.label, count: r.n })),
        twoFactor: { enabled: mfa[0]?.on_ ?? 0, total: mfa[0]?.total ?? 0 },
        pendingInvites: pendingList.map((i) => ({ id: i.id, email: i.email, roles: i.roles, expiresAt: i.expiresAt })),
        recentPeople: recentPeople.map((u) => ({ id: u.id, name: u.fullName, email: u.email, lastLoginAt: u.lastLoginAt, twoFactor: u.twoFactorEnabled }))
      };
    });
  }
}
