import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export interface SettleInput {
  method: 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CARD' | 'GATEWAY';
  reference: string;
  /** Platform admin who recorded it; null when a verified gateway callback did. */
  actorId: string | null;
  gatewayPaymentId?: string;
}

/**
 * The one place an invoice becomes PAID. Runs inside a platform transaction.
 * Switches the customer's plan on, starts a month of service, and logs who/what recorded it.
 * Safe to call twice: a second call on a paid invoice throws Conflict and changes nothing.
 */
export async function settleInvoice(tx: any, id: string, input: SettleInput) {
  const inv = await tx.invoice.findUnique({ where: { id } });
  if (!inv) throw new NotFoundException('Invoice not found.');
  if (inv.status !== 'UNPAID') throw new ConflictException(`This invoice is ${inv.status.toLowerCase()}.`);
  if (!inv.planId) throw new BadRequestException('This invoice is not linked to a plan.');
  const dup = await tx.invoice.findFirst({ where: { paymentReference: input.reference, paymentMethod: input.method, id: { not: id } } });
  if (dup) throw new ConflictException(`That payment reference is already recorded against ${dup.invoiceNumber}.`);
  // Claim the invoice atomically so a webhook and a browser callback arriving together settle it once.
  const claim = await tx.invoice.updateMany({ where: { id, status: 'UNPAID' }, data: { status: 'PAID' } });
  if (claim.count === 0) throw new ConflictException('This invoice is paid already.');
  const paidAt = new Date();
  const start = new Date(Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate()));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
  const existing = await tx.subscription.findFirst({ where: { organizationId: inv.organizationId }, orderBy: { createdAt: 'desc' } });
  const sub = existing
    ? await tx.subscription.update({ where: { id: existing.id }, data: { planId: inv.planId, status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: end, cancelledAt: null } })
    : await tx.subscription.create({ data: { organizationId: inv.organizationId, planId: inv.planId, status: 'ACTIVE', currentPeriodStart: start, currentPeriodEnd: end } });
  await tx.organization.update({ where: { id: inv.organizationId }, data: { planId: inv.planId, status: 'ACTIVE' } });
  const paid = await tx.invoice.update({
    where: { id },
    data: { status: 'PAID', paidAt, paymentMethod: input.method, paymentReference: input.reference, subscriptionId: sub.id, servicePeriodStart: start, servicePeriodEnd: end, ...(input.gatewayPaymentId ? { razorpayPaymentId: input.gatewayPaymentId } : {}) }
  });
  await tx.platformAuditLog.create({
    data: { actorId: input.actorId ?? 'gateway', action: input.actorId ? 'INVOICE_MARKED_PAID' : 'INVOICE_PAID_BY_GATEWAY', targetOrg: inv.organizationId, metadata: { invoice: inv.invoiceNumber, method: input.method, reference: input.reference } }
  });
  // Tell the customer's billing people the payment is in. A failure here must never undo the payment.
  try {
    const people = await tx.userRole.findMany({ where: { organizationId: inv.organizationId, role: { in: ['ORG_ADMIN', 'FINANCE_MANAGER'] }, user: { isActive: true } }, select: { userId: true } });
    const ids = [...new Set(people.map((r: any) => r.userId))] as string[];
    if (ids.length) await tx.notification.createMany({ data: ids.map((userId) => ({ organizationId: inv.organizationId, userId, category: 'BILLING', title: 'Payment received', body: `We received your payment for invoice ${inv.invoiceNumber}. Your plan is active.` })) });
  } catch { /* convenience only */ }
  return paid;
}
