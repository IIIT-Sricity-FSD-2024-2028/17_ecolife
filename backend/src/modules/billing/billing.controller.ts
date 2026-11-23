import { BadRequestException, Body, ConflictException, Controller, Get, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { writeAuditLog } from '../../common/utils/audit.util';
import { getEnv } from '../../config/env.validation';
import { fyStartYearFor } from '../../common/utils/fiscal.util';

const upgradeSchema = z.object({ planCode: z.string().trim().min(1).max(60) });
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

import { pageResult, parsePaging } from '../../common/utils/paging.util';
@ApiTags('GST Billing & Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER')
  overview(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [organization, plans, subscription, invoices, facilities, users] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: orgId }, include: { plan: true } }),
        tx.plan.findMany({ where: { isActive: true }, orderBy: { priceInrMonth: 'asc' } }),
        tx.subscription.findFirst({ where: { organizationId: orgId }, include: { plan: true }, orderBy: { createdAt: 'desc' } }),
        tx.invoice.findMany({ where: { organizationId: orgId }, orderBy: { issuedAt: 'desc' }, take: 24 }),
        tx.facility.count({ where: { organizationId: orgId, effectiveTo: null } }),
        tx.user.count({ where: { organizationId: orgId, isActive: true } })
      ]);
      const env = getEnv();
      return { organization, plans, subscription, invoices, usage: { facilities, users }, invoicingConfigured: Boolean(env.BILLING_SUPPLIER_GSTIN && env.BILLING_SAC_CODE && env.BILLING_GST_RATE_PCT != null && env.BILLING_SUPPLIER_NAME) };
    });
  }

  /** All of this company's invoices, newest first. Paged with ?status; no paging returns the latest 24. */
  @Get('invoices')
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER')
  invoices(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const orgId = user.organizationId!;
    const where: any = { organizationId: orgId, ...(q.status ? { status: q.status } : {}) };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (!paged) return tx.invoice.findMany({ where, orderBy: { issuedAt: 'desc' }, take: 24 });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.invoice.findMany({ where, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.invoice.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  /**
   * Asks for a plan change. Nothing is granted here: the plan stays as it is and a GST invoice is raised as UNPAID.
   * The plan switches on when the platform team records the payment against that invoice.
   */
  @Post('upgrade')
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER')
  upgrade(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(upgradeSchema)) input: z.infer<typeof upgradeSchema>) {
    const orgId = user.organizationId!;
    const env = getEnv();
    const supplierGstin = env.BILLING_SUPPLIER_GSTIN, sac = env.BILLING_SAC_CODE, rate = env.BILLING_GST_RATE_PCT;
    if (!supplierGstin || !sac || rate == null || !env.BILLING_SUPPLIER_NAME) {
      throw new ServiceUnavailableException('Invoicing is not set up yet. Please contact Tropos support to change your plan.');
    }
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, include: { plan: true } });
      const plan = await tx.plan.findFirst({ where: { code: input.planCode, isActive: true } });
      if (!plan) throw new BadRequestException('That plan does not exist or is no longer offered.');
      if (plan.id === org.planId && org.status === 'ACTIVE') throw new ConflictException('You are already on this plan.');
      if (!org.gstin || !GSTIN_RE.test(org.gstin)) throw new BadRequestException('Add your company GSTIN in Organization settings first. It is printed on the GST invoice.');
      if (!org.billingAddress) throw new BadRequestException('Add your billing address in Organization settings first. It is printed on the GST invoice.');
      const [facilities, users, openInvoice] = await Promise.all([
        tx.facility.count({ where: { organizationId: orgId, effectiveTo: null } }),
        tx.user.count({ where: { organizationId: orgId, isActive: true } }),
        tx.invoice.findFirst({ where: { organizationId: orgId, status: 'UNPAID' } })
      ]);
      if (openInvoice) throw new ConflictException(`Invoice ${openInvoice.invoiceNumber} is still unpaid. Pay or cancel it before requesting another plan change.`);
      if (facilities > plan.maxFacilities) throw new ConflictException(`${plan.name} allows ${plan.maxFacilities} facilities and you have ${facilities}. Choose a larger plan.`);
      if (users > plan.maxUsers) throw new ConflictException(`${plan.name} allows ${plan.maxUsers} users and you have ${users} active. Deactivate some users or choose a larger plan.`);

      const subtotal = Number(plan.priceInrMonth);
      // Intra-state supply (same GST state code) is CGST + SGST; inter-state is IGST.
      const interState = org.gstin.slice(0, 2) !== supplierGstin.slice(0, 2);
      const half = Number(((subtotal * rate) / 200).toFixed(2));
      const full = Number(((subtotal * rate) / 100).toFixed(2));
      const cgst = interState ? 0 : half, sgst = interState ? 0 : half, igst = interState ? full : 0;
      const total = Number((subtotal + cgst + sgst + igst).toFixed(2));
      const now = new Date();
      // GST invoice series follow the statutory April-March year, not the customer's own year.
      const fyStart = fyStartYearFor(now.getUTCFullYear(), now.getUTCMonth() + 1, 4);
      const fy = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
      const counter = await tx.$queryRaw<{ lastNumber: number }[]>`INSERT INTO "InvoiceCounter" ("financialYear","lastNumber") VALUES (${fy},1) ON CONFLICT ("financialYear") DO UPDATE SET "lastNumber" = "InvoiceCounter"."lastNumber" + 1 RETURNING "lastNumber"`;
      // GST caps invoice numbers at 16 characters: TRP + 4-digit FY + / + 5-digit serial = 13.
      const number = `TRP${String(fyStart % 100).padStart(2, '0')}${fy.slice(-2)}/${String(counter[0].lastNumber).padStart(5, '0')}`;
      const due = new Date(now.getTime() + env.BILLING_PAYMENT_TERMS_DAYS * 86400000);
      const invoice = await tx.invoice.create({
        data: {
          organizationId: orgId, invoiceNumber: number, sacCode: sac, subtotalInr: subtotal, cgstInr: cgst, sgstInr: sgst, igstInr: igst, totalInr: total, status: 'UNPAID',
          planId: plan.id, planName: plan.name, gstRatePct: rate, placeOfSupply: org.gstin.slice(0, 2), supplierGstin,
          customerName: org.name, customerGstin: org.gstin, customerAddress: org.billingAddress, dueAt: due
        }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'PLAN_CHANGE_REQUESTED', resourceType: 'Invoice', resourceId: invoice.id, metadata: { planCode: plan.code, invoiceNumber: number, total } });
      return { invoice, message: `Invoice ${number} for ${plan.name} has been raised. Your plan changes as soon as the payment is recorded.` };
    });
  }
}
