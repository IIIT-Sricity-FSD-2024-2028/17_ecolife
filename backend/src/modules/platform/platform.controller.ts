import { Prisma } from '../../generated/prisma';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { appLink } from '../../config/platform.constants';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { lookupUnit } from '../../common/utils/units';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import crypto from 'crypto';
import { sha256 } from '../../common/utils/crypto.util';
import { devPreviewEnabled, getEnv } from '../../config/env.validation';
import { settleInvoice } from '../../common/payments/settle-invoice';
import { renderInvoicePdf, supplierFromEnv } from '../../common/payments/invoice-pdf';
import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

const orgStatusSchema = z.object({ status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED']), reason: z.string().trim().min(10).max(1000) });
const approvalRequestSchema = z.object({ organizationId: z.string().min(1), actionType: z.enum(['ORG_CLOSE_OFFBOARD']), reason: z.string().trim().min(10).max(1000) });
const approvalDecisionSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });
const markPaidSchema = z.object({ paymentMethod: z.enum(['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'GATEWAY']), paymentReference: z.string().trim().min(4).max(100) });
const reasonSchema = z.object({ reason: z.string().trim().min(10).max(500) });
const trialSchema = z.object({ days: z.number().int().min(1).max(60), reason: z.string().trim().min(10).max(500) });
const cancelInvoiceSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const releaseSchema = z.object({ dryRun: z.boolean().optional(), factors: z.array(z.lazy(() => globalFactorSchema)).min(1).max(500) });
const releaseDecisionSchema = z.object({ versionLabel: z.string().trim().min(1).max(40), proposedById: z.string().min(5).max(40), decision: z.enum(['APPROVE', 'REJECT']), note: z.string().trim().min(5).max(500).optional() })
  .refine((v) => v.decision === 'APPROVE' || !!v.note, 'Say why the release is rejected.');
const globalFactorSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_\-]{3,60}$/),
  name: z.string().trim().min(3).max(200),
  domain: z.enum(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT']),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3', 'BIOGENIC', 'NON_GHG']),
  tier: z.enum(['NATIONAL_OFFICIAL', 'GLOBAL_OFFICIAL']),
  regimeTag: z.enum(['GENERAL', 'BRSR_GHG_PROTOCOL', 'BEE_CCTS']),
  region: z.string().trim().min(2).max(10),
  sourceAuthority: z.string().trim().min(3).max(300),
  versionLabel: z.string().trim().min(1).max(40),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  canonicalUnit: z.string().trim().min(1).max(30),
  co2KgPerUnit: z.number().min(0).max(1e7),
  ch4KgPerUnit: z.number().min(0).max(1e7).default(0),
  n2oKgPerUnit: z.number().min(0).max(1e7).default(0)
}).refine((v) => v.co2KgPerUnit > 0 || v.ch4KgPerUnit > 0 || v.n2oKgPerUnit > 0, 'A factor needs at least one gas value above zero.');

@ApiTags('Platform Admin Console')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  overview() {
    return this.prisma.withPlatformTx(async (tx) => {
      const [organizations, plans, approvals, globalFactors, gwpTable, platformLogs] = await Promise.all([
        tx.organization.findMany({ include: { plan: true, _count: { select: { users: true, facilities: true, entries: true } } }, orderBy: { createdAt: 'desc' } }),
        tx.plan.findMany({ orderBy: { priceInrMonth: 'asc' } }),
        tx.platformActionApproval.findMany({ include: { organization: { select: { name: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
        tx.emissionFactor.findMany({ where: { organizationId: null }, orderBy: { code: 'asc' } }),
        tx.gwpTable.findMany({ orderBy: { gasCode: 'asc' } }),
        tx.platformAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 40 })
      ]);
      return { organizations, plans, approvals, globalFactors, gwpTable, platformLogs };
    });
  }

  /** Companies, plans, money and usage over time for the platform dashboard. Small answers: one row per month, status or plan. */
  @Get('analytics')
  analytics() {
    return this.prisma.withPlatformTx(async (tx) => {
      const [signups, byStatus, byPlan, invoices, volume, growth] = await Promise.all([
        tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(m, 'Mon YY') AS label, COALESCE(c.n,0)::int AS n FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
          LEFT JOIN (SELECT date_trunc('month', "createdAt") AS mo, COUNT(*) AS n FROM "Organization" GROUP BY 1) c ON c.mo = m ORDER BY m`),
        tx.organization.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT p.name, p."priceInrMonth"::float8 AS price, COUNT(o.id)::int AS orgs, COUNT(o.id) FILTER (WHERE o.status = 'ACTIVE')::int AS paying
          FROM "Plan" p LEFT JOIN "Organization" o ON o."planId" = p.id GROUP BY p.id ORDER BY p."priceInrMonth"`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(m, 'Mon YY') AS label, COALESCE(c.paid,0)::float8 AS paid, COALESCE(c.open,0)::float8 AS open FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
          LEFT JOIN (SELECT date_trunc('month', "issuedAt") AS mo, SUM("totalInr") FILTER (WHERE status = 'PAID') AS paid, SUM("totalInr") FILTER (WHERE status <> 'PAID') AS open FROM "Invoice" GROUP BY 1) c ON c.mo = m ORDER BY m`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT to_char(m, 'Mon YY') AS label, COALESCE(c.n,0)::int AS n FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
          LEFT JOIN (SELECT date_trunc('month', "createdAt") AS mo, COUNT(*) AS n FROM "ResourceEntry" GROUP BY 1) c ON c.mo = m ORDER BY m`),
        tx.$queryRaw<any[]>(Prisma.sql`SELECT o.name, (SELECT COUNT(*) FROM "ResourceEntry" e WHERE e."organizationId" = o.id)::int AS records, (SELECT COUNT(*) FROM "User" u WHERE u."organizationId" = o.id)::int AS users
          FROM "Organization" o ORDER BY records DESC LIMIT 8`)
      ]);
      const mrr = byPlan.reduce((s, p) => s + p.price * p.paying, 0);
      return {
        signups, invoices, recordsPerMonth: volume, mrrInr: Math.round(mrr),
        byStatus: Object.fromEntries(byStatus.map((r: any) => [r.status, r._count._all])),
        byPlan: byPlan.map((p) => ({ name: p.name, orgs: p.orgs, paying: p.paying, priceInrMonth: p.price })),
        topOrganizations: growth
      };
    });
  }

  /** Small numbers for the front page. Nothing here grows with the number of customers. */
  @Get('summary')
  summary() {
    return this.prisma.withPlatformTx(async (tx) => {
      const soon = new Date(Date.now() + 7 * 86400000);
      const [byStatus, users, unpaid, approvals, trialsEnding, pendingFactors, plans] = await Promise.all([
        tx.organization.groupBy({ by: ['status'], _count: { _all: true } }),
        tx.user.count({ where: { isPlatformAdmin: false } }),
        tx.invoice.aggregate({ where: { status: 'UNPAID' }, _count: { _all: true }, _sum: { totalInr: true } }),
        tx.platformActionApproval.findMany({ where: { status: 'PENDING' }, include: { organization: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 20 }),
        tx.organization.findMany({ where: { status: 'TRIAL', trialEndsAt: { lte: soon } }, orderBy: { trialEndsAt: 'asc' }, take: 10, select: { id: true, name: true, trialEndsAt: true } }),
        tx.emissionFactor.count({ where: { organizationId: null, status: 'PENDING_APPROVAL' } }),
        tx.plan.findMany({ orderBy: { priceInrMonth: 'asc' }, select: { id: true, code: true, name: true } })
      ]);
      return {
        organizations: Object.fromEntries(byStatus.map((r: any) => [r.status, r._count._all])),
        users, unpaidInvoices: { count: unpaid._count._all, totalInr: unpaid._sum.totalInr ?? 0 },
        pendingApprovals: approvals, trialsEndingSoon: trialsEnding, pendingFactorRows: pendingFactors, plans
      };
    });
  }

  /** The gas warming values (GWP) every calculation uses. A few rows. */
  @Get('gwp-table')
  gwpTable() { return this.prisma.withPlatformTx((tx) => tx.gwpTable.findMany({ orderBy: { gasCode: 'asc' } })); }

  /** Every company, paged. ?q searches name, CIN and GSTIN; ?status and ?planId narrow it. */
  @Get('organizations')
  async organizationList(@Query() q: Record<string, any>) {
    const paging = parsePaging(q.page === undefined && q.pageSize === undefined ? { page: 1, pageSize: 25 } : q);
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = { ...(q.status ? { status: String(q.status) } : {}), ...(q.planId ? { planId: String(q.planId) } : {}),
      ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { cin: { contains: term, mode: 'insensitive' } }, { gstin: { contains: term, mode: 'insensitive' } }] } : {}) };
    return this.prisma.withPlatformTx(async (tx) => {
      const [items, total] = await Promise.all([
        tx.organization.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take,
          select: { id: true, name: true, status: true, trialEndsAt: true, createdAt: true, plan: { select: { name: true } }, _count: { select: { users: true, facilities: true } } } }),
        tx.organization.count({ where })
      ]);
      return pageResult(paging, items, total);
    });
  }

  @Patch('organizations/:id/status')
  updateOrgStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(orgStatusSchema)) input: z.infer<typeof orgStatusSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id } });
      if (!org) throw new NotFoundException('Organization not found.');
      if (org.status === 'CLOSED') throw new ConflictException('A closed organization cannot be changed.');
      const updated = await tx.organization.update({ where: { id }, data: { status: input.status } });
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: `ORG_STATUS_${input.status}`, targetOrg: id, metadata: { reason: input.reason, from: org.status } } });
      // Suspending cuts live sessions immediately so no one keeps working on a stale token.
      if (input.status === 'SUSPENDED') await tx.userSession.updateMany({ where: { user: { organizationId: id }, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
  }

  @Post('approvals')
  requestApproval(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(approvalRequestSchema)) input: z.infer<typeof approvalRequestSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: input.organizationId } });
      if (!org) throw new NotFoundException('Organization not found.');
      if (org.status === 'CLOSED') throw new ConflictException('This organization is already closed.');
      const open = await tx.platformActionApproval.findFirst({ where: { organizationId: input.organizationId, actionType: input.actionType, status: 'PENDING' } });
      if (open) throw new ConflictException('A request for this action is already waiting for a second administrator.');
      const app = await tx.platformActionApproval.create({ data: { organizationId: input.organizationId, actionType: input.actionType, reason: input.reason, status: 'PENDING', requestedById: user.userId } });
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: 'DUAL_ADMIN_APPROVAL_REQUESTED', targetOrg: input.organizationId, metadata: input } });
      return app;
    });
  }

  @Patch('approvals/:id/decide')
  decideApproval(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) input: z.infer<typeof approvalDecisionSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const row = await tx.platformActionApproval.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Approval request not found.');
      if (row.requestedById === user.userId) throw new ForbiddenException('Dual-admin rule: a second Platform Admin must decide this.');
      const claimed = await tx.platformActionApproval.updateMany({ where: { id, status: 'PENDING' }, data: { status: input.status, approvedById: user.userId, decidedAt: new Date() } });
      if (claimed.count === 0) throw new ConflictException('This request has already been decided.');
      if (input.status === 'APPROVED' && row.actionType === 'ORG_CLOSE_OFFBOARD') {
        const now = new Date();
        await tx.organization.update({ where: { id: row.organizationId }, data: { status: 'CLOSED', closedAt: now, retentionLockUntil: new Date(Date.UTC(now.getUTCFullYear() + 8, now.getUTCMonth(), now.getUTCDate())) } });
        await tx.userSession.updateMany({ where: { user: { organizationId: row.organizationId }, revokedAt: null }, data: { revokedAt: now } });
      }
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: `DUAL_ADMIN_${input.status}`, targetOrg: row.organizationId, metadata: { approvalId: id, actionType: row.actionType } } });
      return tx.platformActionApproval.findUniqueOrThrow({ where: { id } });
    });
  }

  // ---------------------------------------------------------------- support tools
  // Platform admins can look after accounts but never read a customer's emission records.
  // Every action needs a reason and is written to the platform audit log.

  @Get('users')
  async users(@Query() q: Record<string, any>) {
    const paging = parsePaging(q.page === undefined && q.pageSize === undefined ? { page: 1, pageSize: 25 } : q);
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = { isPlatformAdmin: false, ...(q.organizationId ? { organizationId: String(q.organizationId) } : {}),
      ...(term ? { OR: [{ email: { contains: term, mode: 'insensitive' } }, { fullName: { contains: term, mode: 'insensitive' } }] } : {}) };
    return this.prisma.withPlatformTx(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.user.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take,
          select: { id: true, email: true, fullName: true, isActive: true, emailVerifiedAt: true, twoFactorEnabled: true, lastLoginAt: true, lockedUntil: true, failedLoginCount: true, createdAt: true,
            organization: { select: { id: true, name: true, status: true } } } }),
        tx.user.count({ where })
      ]);
      const now = Date.now();
      return pageResult(paging, rows.map((u: any) => ({ ...u, isLocked: !!u.lockedUntil && u.lockedUntil.getTime() > now })), total);
    });
  }

  private async supportTarget(tx: any, id: string) {
    const u = await tx.user.findUnique({ where: { id } });
    if (!u || u.isPlatformAdmin) throw new NotFoundException('User not found.');
    return u;
  }

  @Post('users/:id/unlock')
  unlockUser(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(reasonSchema)) input: z.infer<typeof reasonSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const u = await this.supportTarget(tx, id);
      await tx.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
      await tx.platformAuditLog.create({ data: { actorId: actor.userId, action: 'USER_UNLOCKED', targetOrg: u.organizationId, metadata: { userId: id, email: u.email, reason: input.reason } } });
      return { unlocked: true };
    });
  }

  @Post('users/:id/reset-two-factor')
  resetTwoFactor(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(reasonSchema)) input: z.infer<typeof reasonSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const u = await this.supportTarget(tx, id);
      if (!u.twoFactorEnabled) throw new ConflictException('Two-factor sign-in is not switched on for this person.');
      await tx.user.update({ where: { id }, data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodeHashes: [], twoFactorLastStep: null } });
      await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }); // sign them out everywhere
      await tx.platformAuditLog.create({ data: { actorId: actor.userId, action: 'USER_2FA_RESET', targetOrg: u.organizationId, metadata: { userId: id, email: u.email, reason: input.reason } } });
      return { reset: true };
    });
  }

  @Post('users/:id/resend-verification')
  resendVerification(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(reasonSchema)) input: z.infer<typeof reasonSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const u = await this.supportTarget(tx, id);
      if (u.emailVerifiedAt) throw new ConflictException('This email address is already verified.');
      const recent = await tx.emailVerificationToken.findFirst({ where: { userId: id, createdAt: { gt: new Date(Date.now() - 60 * 1000) } } });
      if (recent) throw new ConflictException('A verification email was sent less than a minute ago.');
      const raw = crypto.randomBytes(24).toString('hex');
      await tx.emailVerificationToken.create({ data: { userId: id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      await tx.emailOutbox.create({ data: { organizationId: u.organizationId, toEmail: u.email, subject: 'Verify your Tropos ERP account', bodyText: `Confirm your email address:\n${appLink('/verify-email?token=' + raw)}`, category: 'EMAIL_VERIFICATION', status: 'PENDING' } });
      await tx.platformAuditLog.create({ data: { actorId: actor.userId, action: 'VERIFICATION_RESENT', targetOrg: u.organizationId, metadata: { userId: id, email: u.email, reason: input.reason } } });
      return { queued: true, devPreviewToken: devPreviewEnabled() ? raw : undefined };
    });
  }

  @Post('organizations/:id/extend-trial')
  extendTrial(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(trialSchema)) input: z.infer<typeof trialSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id } });
      if (!org) throw new NotFoundException('Organization not found.');
      if (org.status !== 'TRIAL') throw new ConflictException('Only a company that is still on a trial can have its trial extended.');
      const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date(); // never shorten, never extend from the past
      const trialEndsAt = new Date(base.getTime() + input.days * 86400000);
      await tx.organization.update({ where: { id }, data: { trialEndsAt } });
      await tx.platformAuditLog.create({ data: { actorId: actor.userId, action: 'TRIAL_EXTENDED', targetOrg: id, metadata: { days: input.days, from: org.trialEndsAt, to: trialEndsAt, reason: input.reason } } });
      return { trialEndsAt };
    });
  }

  @Get('organizations/:id')
  organizationDetail(@Param('id') id: string) {
    return this.prisma.withPlatformTx(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id }, include: { plan: true, _count: { select: { users: true, facilities: true, entries: true } } } });
      if (!org) throw new NotFoundException('Organization not found.');
      const [lastLogin, lastEntry, invoices, openApprovals] = await Promise.all([
        tx.user.aggregate({ where: { organizationId: id }, _max: { lastLoginAt: true } }),
        tx.resourceEntry.aggregate({ where: { organizationId: id }, _max: { createdAt: true } }),
        tx.invoice.findMany({ where: { organizationId: id }, orderBy: { issuedAt: 'desc' }, take: 10, select: { id: true, invoiceNumber: true, status: true, totalInr: true, issuedAt: true, dueAt: true } }),
        tx.platformActionApproval.count({ where: { organizationId: id, status: 'PENDING' } })
      ]);
      return { organization: org, lastLoginAt: lastLogin._max.lastLoginAt, lastEntryAt: lastEntry._max.createdAt, invoices, openApprovals };
    });
  }

  @Get('activity')
  async activity(@Query() q: Record<string, any>) {
    const paging = parsePaging(q.page === undefined && q.pageSize === undefined ? { page: 1, pageSize: 50 } : q);
    const where: any = { ...(q.organizationId ? { targetOrg: String(q.organizationId) } : {}), ...(q.action ? { action: String(q.action) } : {}) };
    return this.prisma.withPlatformTx(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.platformAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take }),
        tx.platformAuditLog.count({ where })
      ]);
      return pageResult(paging, rows, total);
    });
  }

  @Get('invoices')
  invoices(@Query() q: Record<string, any>) {
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = { ...(q.status ? { status: String(q.status) } : {}), ...(q.organizationId ? { organizationId: String(q.organizationId) } : {}),
      ...(term ? { OR: [{ invoiceNumber: { contains: term, mode: 'insensitive' } }, { organization: { name: { contains: term, mode: 'insensitive' } } }] } : {}) };
    const include = { organization: { select: { name: true, gstin: true } } };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withPlatformTx(async (tx) => {
      if (!paged) return tx.invoice.findMany({ where, include, orderBy: { issuedAt: 'desc' }, take: 200 });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.invoice.findMany({ where, include, orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take }), tx.invoice.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@Param('id') id: string, @Res() res: any) {
    const inv = await this.prisma.withPlatformTx((tx) => tx.invoice.findUnique({ where: { id } }));
    if (!inv) throw new NotFoundException('Invoice not found.');
    const pdf = await renderInvoicePdf(inv, supplierFromEnv(getEnv()));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber.replace('/', '-')}.pdf"`);
    res.send(pdf);
  }

  /** Records that payment arrived (bank transfer reference, UPI, gateway id...) and only then switches the customer's plan. */
  @Post('invoices/:id/mark-paid')
  markPaid(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(markPaidSchema)) input: z.infer<typeof markPaidSchema>) {
    return this.prisma.withPlatformTx((tx) => settleInvoice(tx, id, { method: input.paymentMethod, reference: input.paymentReference, actorId: user.userId }));
  }

  @Post('invoices/:id/cancel')
  cancelInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(cancelInvoiceSchema)) input: z.infer<typeof cancelInvoiceSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const r = await tx.invoice.updateMany({ where: { id, status: 'UNPAID' }, data: { status: 'CANCELLED' } });
      if (r.count === 0) throw new ConflictException('Only an unpaid invoice can be cancelled.');
      const inv = await tx.invoice.findUniqueOrThrow({ where: { id } });
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: 'INVOICE_CANCELLED', targetOrg: inv.organizationId, metadata: { invoice: inv.invoiceNumber, reason: input.reason } } });
      return inv;
    });
  }

  // ---------------------------------------------------------------- emission factor library
  // Nothing reaches customers from one person's hand: a release is proposed (as pending),
  // checked in a dry run, and published only when a different administrator approves it.

  @Get('factors')
  async factorLibrary(@Query() q: Record<string, any>) {
    const paging = parsePaging(q.page === undefined && q.pageSize === undefined ? { page: 1, pageSize: 25 } : q);
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = { organizationId: null, ...(q.status ? { status: String(q.status) } : {}), ...(q.domain ? { domain: String(q.domain) } : {}),
      ...(term ? { OR: [{ code: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }, { sourceAuthority: { contains: term, mode: 'insensitive' } }] } : {}) };
    return this.prisma.withPlatformTx(async (tx) => {
      const [items, total] = await Promise.all([
        tx.emissionFactor.findMany({ where, orderBy: [{ code: 'asc' }, { validFrom: 'desc' }], skip: paging.skip, take: paging.take,
          select: { id: true, code: true, name: true, domain: true, scope: true, status: true, region: true, sourceAuthority: true, versionLabel: true, validFrom: true, validTo: true, canonicalUnit: true, co2KgPerUnit: true, ch4KgPerUnit: true, n2oKgPerUnit: true } }),
        tx.emissionFactor.count({ where })
      ]);
      return pageResult(paging, items, total);
    });
  }

  /** Releases waiting for a second administrator. */
  @Get('factor-releases')
  releases() {
    return this.prisma.withPlatformTx(async (tx) => {
      const rows = await tx.emissionFactor.findMany({ where: { organizationId: null, status: 'PENDING_APPROVAL' }, orderBy: [{ createdAt: 'desc' }], take: LEGACY_CAP,
        select: { id: true, code: true, name: true, versionLabel: true, validFrom: true, sourceAuthority: true, co2KgPerUnit: true, canonicalUnit: true, createdById: true, createdAt: true } });
      const groups = new Map<string, any>();
      for (const r of rows) {
        const key = `${r.versionLabel}|${r.createdById}`;
        const g = groups.get(key) ?? { versionLabel: r.versionLabel, proposedById: r.createdById, proposedAt: r.createdAt, sourceAuthority: r.sourceAuthority, count: 0, factors: [] as any[] };
        g.count += 1; if (g.factors.length < 50) g.factors.push({ code: r.code, name: r.name, co2KgPerUnit: r.co2KgPerUnit, canonicalUnit: r.canonicalUnit, validFrom: r.validFrom });
        groups.set(key, g);
      }
      return [...groups.values()];
    });
  }

  private async checkRelease(tx: any, factors: z.infer<typeof globalFactorSchema>[]) {
    const errors: { row: number; code?: string; message: string }[] = [];
    const seen = new Set<string>();
    let supersedes = 0;
    for (let i = 0; i < factors.length; i++) {
      const f = factors[i];
      const row = i + 1;
      try { lookupUnit(f.canonicalUnit); } catch (e: any) { errors.push({ row, code: f.code, message: e?.message ?? 'Unknown unit.' }); }
      if (f.validTo && f.validTo <= f.validFrom) errors.push({ row, code: f.code, message: 'The validity end must be after the start.' });
      const key = `${f.code}|${f.versionLabel}`;
      if (seen.has(key)) errors.push({ row, code: f.code, message: 'This code and version appear twice in the file.' });
      seen.add(key);
    }
    if (factors.length) {
      const existing = await tx.emissionFactor.findMany({ where: { organizationId: null, OR: factors.map((f) => ({ code: f.code, versionLabel: f.versionLabel })) }, select: { code: true, versionLabel: true } });
      const ex = new Set(existing.map((e: any) => `${e.code}|${e.versionLabel}`));
      factors.forEach((f, i) => { if (ex.has(`${f.code}|${f.versionLabel}`)) errors.push({ row: i + 1, code: f.code, message: `${f.code} ${f.versionLabel} already exists. Use a new version label.` }); });
      const codes = [...new Set(factors.map((f) => f.code))];
      const live = await tx.emissionFactor.findMany({ where: { organizationId: null, status: 'PUBLISHED', code: { in: codes } }, select: { code: true }, distinct: ['code'] });
      supersedes = live.length;
      return { errors, summary: { rows: factors.length, newCodes: codes.length - supersedes, replacesCurrent: supersedes } };
    }
    return { errors, summary: { rows: 0, newCodes: 0, replacesCurrent: 0 } };
  }

  /** Check (dryRun) or propose a whole release. All rows are valid or nothing is stored. */
  @Post('factor-releases')
  proposeRelease(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(releaseSchema)) input: z.infer<typeof releaseSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const check = await this.checkRelease(tx, input.factors);
      if (input.dryRun || check.errors.length) return { dryRun: !!input.dryRun, stored: false, ...check };
      await tx.emissionFactor.createMany({ data: input.factors.map((f) => ({ organizationId: null, ...f, status: 'PENDING_APPROVAL' as const, isLocked: false, createdById: user.userId })) });
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: 'FACTOR_RELEASE_PROPOSED', metadata: { count: input.factors.length, versions: [...new Set(input.factors.map((f) => f.versionLabel))] } } });
      return { dryRun: false, stored: true, ...check };
    });
  }

  /** A different administrator approves (publishes) or rejects a whole pending release. */
  @Post('factor-releases/decide')
  decideRelease(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(releaseDecisionSchema)) input: z.infer<typeof releaseDecisionSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const rows = await tx.emissionFactor.findMany({ where: { organizationId: null, status: 'PENDING_APPROVAL', versionLabel: input.versionLabel, createdById: input.proposedById }, orderBy: { validFrom: 'asc' } });
      if (!rows.length) throw new NotFoundException('No pending release found with that version.');
      if (input.proposedById === user.userId) throw new ForbiddenException('Dual-admin rule: a second Platform Admin must decide this release.');
      const now = new Date();
      if (input.decision === 'REJECT') {
        await tx.emissionFactor.updateMany({ where: { id: { in: rows.map((r: any) => r.id) }, status: 'PENDING_APPROVAL' }, data: { status: 'REJECTED', rejectionNote: input.note, approvedById: user.userId, approvedAt: now } });
      } else {
        for (const r of rows) {
          // A new version supersedes the previous one from the day it takes effect.
          await tx.emissionFactor.updateMany({ where: { organizationId: null, code: r.code, status: 'PUBLISHED', validFrom: { lt: r.validFrom }, OR: [{ validTo: null }, { validTo: { gt: r.validFrom } }] }, data: { validTo: r.validFrom } });
        }
        await tx.emissionFactor.updateMany({ where: { id: { in: rows.map((r: any) => r.id) }, status: 'PENDING_APPROVAL' }, data: { status: 'PUBLISHED', isLocked: true, approvedById: user.userId, approvedAt: now } });
      }
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: `FACTOR_RELEASE_${input.decision === 'APPROVE' ? 'PUBLISHED' : 'REJECTED'}`, metadata: { versionLabel: input.versionLabel, count: rows.length, proposedById: input.proposedById, note: input.note ?? null } } });
      return { decision: input.decision, count: rows.length };
    });
  }

  /** A single factor is simply a release of one: it still needs a second administrator. */
  @Post('factors')
  proposeGlobalFactor(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(globalFactorSchema)) input: z.infer<typeof globalFactorSchema>) {
    return this.prisma.withPlatformTx(async (tx) => {
      const check = await this.checkRelease(tx, [input]);
      if (check.errors.length) {
        const clash = check.errors.find((e) => e.message.includes('already exists'));
        if (clash) throw new ConflictException(clash.message);
        throw new BadRequestException(check.errors[0].message);
      }
      const factor = await tx.emissionFactor.create({ data: { organizationId: null, ...input, status: 'PENDING_APPROVAL', isLocked: false, createdById: user.userId } });
      await tx.platformAuditLog.create({ data: { actorId: user.userId, action: 'FACTOR_RELEASE_PROPOSED', metadata: { count: 1, versions: [input.versionLabel], code: input.code } } });
      return factor;
    });
  }
}
