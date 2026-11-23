import { Controller, Get, Injectable, Logger, OnModuleDestroy, OnModuleInit, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { getEnv } from '../../config/env.validation';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class EmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxService.name);
  private dispatchTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Dispatch pending outbox emails (OTPs, verifications, invites, resets) every 20s
    this.dispatchTimer = setInterval(() => {
      this.processPendingBatch().catch((err) => this.logger.warn(`Outbox worker skipped: ${err.message}`));
    }, 20_000);

    // Mark expired Supplier PCF requests every 15 minutes
    this.cleanupTimer = setInterval(() => {
      this.expireStaleRequests().catch((err) => this.logger.warn(`Cleanup tick skipped: ${err.message}`));
    }, 15 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private async deliverEmail(toEmail: string, subject: string, bodyText: string, bodyHtml?: string | null) {
    const env = getEnv();

    if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [toEmail],
          subject,
          text: bodyText,
          html: bodyHtml || undefined
        })
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Resend API error (${res.status}): ${errTxt}`);
      }
      return;
    }

    if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
      });
      await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: toEmail,
        subject,
        text: bodyText,
        html: bodyHtml || undefined
      });
      return;
    }

    // Local development fallback (console mode)
    this.logger.log(`[EMAIL_OUTBOX console] To: ${toEmail} | Subject: ${subject} | Body: ${bodyText}`);
  }

  async processPendingBatch() {
    const now = new Date();
    await this.prisma.withPlatformTx(async (tx) => {
      const pending = await tx.emailOutbox.findMany({
        where: { status: 'PENDING', nextRetryAt: { lte: now }, attempts: { lt: 5 } },
        orderBy: { createdAt: 'asc' },
        take: 15
      });

      for (const msg of pending) {
        try {
          await this.deliverEmail(msg.toEmail, msg.subject, msg.bodyText, msg.bodyHtml);
          await tx.emailOutbox.update({
            where: { id: msg.id },
            data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
          });
        } catch (err) {
          const nextDelayMin = Math.pow(2, msg.attempts + 1);
          await tx.emailOutbox.update({
            where: { id: msg.id },
            data: {
              status: msg.attempts + 1 >= 5 ? 'FAILED' : 'PENDING',
              attempts: { increment: 1 },
              lastError: err instanceof Error ? err.message : 'Delivery error',
              nextRetryAt: new Date(Date.now() + nextDelayMin * 60 * 1000)
            }
          });
        }
      }
    });
  }

  async expireStaleRequests() {
    await this.prisma.withPlatformTx(async (tx) => {
      await tx.supplierPcfRequest.updateMany({
        where: { status: { in: ['SENT', 'OTP_VERIFIED'] }, expiresAt: { lt: new Date() } },
        data: { status: 'EXPIRED' }
      });
    });
  }

  /** Delivery status only. Message bodies carry one-time tokens (reset, verify, invite) and are never returned. */
  list(organizationId: string) {
    return this.prisma.withTenantTx(organizationId, (tx) =>
      tx.emailOutbox.findMany({
        where: { organizationId },
        select: { id: true, toEmail: true, subject: true, category: true, status: true, attempts: true, lastError: true, sentAt: true, createdAt: true, nextRetryAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    );
  }

  async dispatchNow(organizationId: string, id: string) {
    return this.prisma.withTenantTx(organizationId, async (tx) => {
      const msg = await tx.emailOutbox.findFirstOrThrow({ where: { id, organizationId } });
      await this.deliverEmail(msg.toEmail, msg.subject, msg.bodyText, msg.bodyHtml);
      return tx.emailOutbox.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
      });
    });
  }
}

@ApiTags('Email Outbox & OTP Dispatcher')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('email-outbox')
export class EmailOutboxController {
  constructor(private readonly service: EmailOutboxService) {}

  @Get()
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD', 'INTERNAL_AUDITOR')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.organizationId!);
  }

  @Post(':id/mark-sent')
  @Roles('ORG_ADMIN')
  markSent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.dispatchNow(user.organizationId!, id);
  }
}
