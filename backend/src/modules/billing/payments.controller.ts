import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import crypto from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { getEnv } from '../../config/env.validation';
import { settleInvoice } from '../../common/payments/settle-invoice';

const confirmSchema = z.object({ orderId: z.string().min(5).max(100), paymentId: z.string().min(5).max(100), signature: z.string().min(10).max(200) });

function hmac(secret: string, data: string | Buffer) { return crypto.createHmac('sha256', secret).update(data).digest('hex'); }
function safeEqual(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const toPaise = (inr: any) => Math.round(Number(inr) * 100);

/** Online card/UPI payment through Razorpay. Off unless PAYMENT_PROVIDER=razorpay and keys are set on the server. */
@ApiTags('Payments')
@Controller('billing')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  private config() {
    const e = getEnv();
    const on = e.PAYMENT_PROVIDER === 'razorpay' && !!e.RAZORPAY_KEY_ID && !!e.RAZORPAY_KEY_SECRET;
    return { on, e, mode: e.RAZORPAY_KEY_ID.startsWith('rzp_live_') ? 'live' : 'test' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER')
  @Get('payments/config')
  paymentConfig() {
    const c = this.config();
    // Only the public key id is ever shown. The secret never leaves the server.
    return { enabled: c.on, provider: c.on ? 'razorpay' : 'none', mode: c.on ? c.mode : null, keyId: c.on ? c.e.RAZORPAY_KEY_ID : null, instructions: c.on ? null : (c.e.PAYMENT_INSTRUCTIONS || null) };
  }

  /** Creates (or reuses) a payment order for one unpaid invoice of the caller's company. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER')
  @Post('invoices/:id/pay')
  async startPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const c = this.config();
    if (!c.on) throw new ServiceUnavailableException('Online payment is not switched on yet. Pay by bank transfer and tell us the reference.');
    const orgId = user.organizationId!;
    const inv = await this.prisma.withTenantTx(orgId, (tx) => tx.invoice.findFirst({ where: { id, organizationId: orgId } }));
    if (!inv) throw new NotFoundException('Invoice not found.');
    if (inv.status !== 'UNPAID') throw new ConflictException(`This invoice is ${inv.status.toLowerCase()}.`);
    if (inv.gatewayOrderId) return { orderId: inv.gatewayOrderId, amountPaise: toPaise(inv.totalInr), currency: 'INR', keyId: c.e.RAZORPAY_KEY_ID, invoiceNumber: inv.invoiceNumber };
    const auth = Buffer.from(`${c.e.RAZORPAY_KEY_ID}:${c.e.RAZORPAY_KEY_SECRET}`).toString('base64');
    let res: Response;
    try {
      res = await fetch(`${c.e.RAZORPAY_API_BASE}/orders`, {
        method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ amount: toPaise(inv.totalInr), currency: 'INR', receipt: inv.invoiceNumber.slice(0, 40), notes: { invoiceId: inv.id } })
      });
    } catch { throw new ServiceUnavailableException('The payment provider could not be reached. Please try again in a minute.'); }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.id) throw new ServiceUnavailableException('The payment provider did not accept the request. Please try again or pay by bank transfer.');
    await this.prisma.withPlatformTx(async (tx) => {
      const r = await tx.invoice.updateMany({ where: { id, status: 'UNPAID', gatewayOrderId: null }, data: { gatewayOrderId: body.id } });
      if (r.count === 0) throw new ConflictException('A payment is already in progress for this invoice.');
    });
    return { orderId: body.id as string, amountPaise: toPaise(inv.totalInr), currency: 'INR', keyId: c.e.RAZORPAY_KEY_ID, invoiceNumber: inv.invoiceNumber };
  }

  /** Called by the browser after the customer pays. The signature proves the provider, not the browser, vouches for it. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('ORG_ADMIN', 'FINANCE_MANAGER')
  @Post('payments/confirm')
  async confirm(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(confirmSchema)) input: z.infer<typeof confirmSchema>) {
    const c = this.config();
    if (!c.on) throw new ServiceUnavailableException('Online payment is not switched on.');
    if (!safeEqual(hmac(c.e.RAZORPAY_KEY_SECRET, `${input.orderId}|${input.paymentId}`), input.signature)) throw new BadRequestException('The payment could not be verified. If money left your account, contact support with the payment id.');
    const orgId = user.organizationId!;
    const inv = await this.prisma.withTenantTx(orgId, (tx) => tx.invoice.findFirst({ where: { gatewayOrderId: input.orderId, organizationId: orgId } }));
    if (!inv) throw new ForbiddenException('That payment does not belong to your company.');
    if (inv.status === 'PAID') return { status: 'PAID', invoiceNumber: inv.invoiceNumber };
    await this.prisma.withPlatformTx((tx) => settleInvoice(tx, inv.id, { method: 'GATEWAY', reference: input.paymentId, actorId: null, gatewayPaymentId: input.paymentId }));
    return { status: 'PAID', invoiceNumber: inv.invoiceNumber };
  }

  /** The provider's own call (works even if the customer closes the tab). Public, so every request is signature-checked. */
  @Post('webhooks/razorpay')
  @HttpCode(200)
  async webhook(@Req() req: any) {
    const c = this.config();
    const secret = c.e.RAZORPAY_WEBHOOK_SECRET;
    if (!c.on || !secret) throw new ServiceUnavailableException('Payment webhooks are not set up.');
    const raw: Buffer | undefined = req.rawBody;
    const sig = String(req.headers['x-razorpay-signature'] ?? '');
    if (!raw || !sig || !safeEqual(hmac(secret, raw), sig)) throw new ForbiddenException('Bad signature.');
    const evt = req.body ?? {};
    if (evt.event !== 'payment.captured' && evt.event !== 'order.paid') return { ok: true, ignored: true };
    const pay = evt.payload?.payment?.entity ?? {};
    const orderId: string | undefined = pay.order_id ?? evt.payload?.order?.entity?.id;
    if (!orderId) return { ok: true, ignored: true };
    return this.prisma.withPlatformTx(async (tx) => {
      const inv = await tx.invoice.findFirst({ where: { gatewayOrderId: orderId } });
      if (!inv) return { ok: true, ignored: true };
      if (inv.status === 'PAID') return { ok: true, duplicate: true };
      if (inv.status !== 'UNPAID') return { ok: true, ignored: true };
      if (pay.currency !== 'INR' || Number(pay.amount) !== toPaise(inv.totalInr)) throw new BadRequestException('Amount does not match the invoice.');
      await settleInvoice(tx, inv.id, { method: 'GATEWAY', reference: String(pay.id), actorId: null, gatewayPaymentId: String(pay.id) });
      return { ok: true };
    });
  }
}
