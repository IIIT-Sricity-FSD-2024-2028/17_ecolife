import { lookupUnit } from '../../common/utils/units';
import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpException, HttpStatus, NotFoundException, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { sha256 } from '../../common/utils/crypto.util';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { devPreviewEnabled } from '../../config/env.validation';

const submitSchema = z.object({
  submittedFactorVal: z.number().finite().positive().max(1_000_000),
  submittedUnit: z.string().trim().min(1).max(40).refine((u) => { try { lookupUnit(u); return true; } catch { return false; } }, 'That unit is not recognised. Pick one from the list.'),
  methodologyNote: z.string().trim().min(10).max(2000)
});

function maskEmail(email: string): string {
  const [u, d] = email.split('@');
  return u && d ? `${u.slice(0, 2)}***@${d}` : '***';
}

@ApiTags('External Supplier Email-OTP Portal (Zero-Account)')
@UseGuards(RateLimitGuard)
@Controller('supplier-portal')
export class SupplierPortalController {
  constructor(private readonly prisma: PrismaService) {}

  /** Token lookup only exposes the request row; supplier/organization are read afterwards inside that tenant's own context. */
  private async loadWithParties(tokenHash: string) {
    const row = await this.prisma.withTokenLookupTx('app.supplier_token_hash', tokenHash, (tx) =>
      tx.supplierPcfRequest.findUnique({ where: { tokenHash } })
    );
    if (!row) return null;
    const parties = await this.prisma.withTenantTx(row.organizationId, async (tx) => ({
      supplier: await tx.supplier.findUniqueOrThrow({ where: { id: row.supplierId }, select: { name: true, contactEmail: true, category: true } }),
      organization: await tx.organization.findUniqueOrThrow({ where: { id: row.organizationId }, select: { name: true } })
    }));
    return { ...row, ...parties };
  }

  @Get(':token')
  async inspect(@Param('token') rawToken: string) {
    const reqRow = await this.loadWithParties(sha256(rawToken));
    if (!reqRow || reqRow.status === 'REVOKED' || reqRow.expiresAt < new Date()) {
      throw new NotFoundException('This link no longer works. It may have expired or been replaced. Ask the company that sent it to send you a new one.');
    }
    return {
      id: reqRow.id,
      organizationName: reqRow.organization.name,
      supplierName: reqRow.supplier.name,
      maskedEmail: maskEmail(reqRow.supplier.contactEmail),
      category: reqRow.supplier.category,
      productDescription: reqRow.productDescription,
      status: reqRow.status,
      otpVerified: Boolean(reqRow.otpVerifiedAt),
      submittedFactorVal: reqRow.submittedFactorVal ? Number(reqRow.submittedFactorVal) : null,
      submittedUnit: reqRow.submittedUnit,
      methodologyNote: reqRow.methodologyNote,
      expiresAt: reqRow.expiresAt
    };
  }

  @Post(':token/request-otp')
  async requestOtp(@Param('token') rawToken: string) {
    const tokenHash = sha256(rawToken);
    const reqRow = await this.loadWithParties(tokenHash);
    if (!reqRow || reqRow.status === 'REVOKED' || reqRow.expiresAt < new Date()) {
      throw new NotFoundException('Supplier request link is invalid or expired.');
    }
    if (['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(reqRow.status)) {
      throw new BadRequestException('This request has already been answered.');
    }
    if (reqRow.otpSentAt && reqRow.otpSentAt > new Date(Date.now() - 60 * 1000)) {
      throw new HttpException('A code was just sent. Wait a minute before requesting another.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const otpCode = String(crypto.randomInt(100000, 1000000));
    await this.prisma.withTenantTx(reqRow.organizationId, async (tx) => {
      await tx.supplierPcfRequest.update({ where: { id: reqRow.id }, data: { otpHash: sha256(otpCode), otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), otpAttempts: 0, otpSentAt: new Date() } });
      await tx.emailOutbox.create({
        data: { organizationId: reqRow.organizationId, toEmail: reqRow.supplier.contactEmail, subject: 'Tropos Supplier Portal OTP', bodyText: `Your 6-digit OTP is: ${otpCode}`, category: 'SUPPLIER_OTP', status: 'PENDING' }
      });
    });
    return { sent: true, maskedEmail: maskEmail(reqRow.supplier.contactEmail), devPreviewOtp: devPreviewEnabled() ? otpCode : undefined };
  }

  @Post(':token/verify-otp')
  async verifyOtp(@Param('token') rawToken: string, @Body() body: { otpCode: string }) {
    const tokenHash = sha256(rawToken);
    const reqRow = await this.prisma.withTokenLookupTx('app.supplier_token_hash', tokenHash, (tx) =>
      tx.supplierPcfRequest.findUnique({ where: { tokenHash } })
    );
    if (!reqRow || !reqRow.otpHash || !reqRow.otpExpiresAt || reqRow.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP expired. Request a new code.');
    }
    if (reqRow.otpAttempts >= 5) {
      throw new HttpException('Too many incorrect codes. Request a new code.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!/^\d{6}$/.test(String(body?.otpCode ?? '')) || sha256(String(body.otpCode)) !== reqRow.otpHash) {
      await this.prisma.withTenantTx(reqRow.organizationId, (tx) =>
        tx.supplierPcfRequest.update({ where: { id: reqRow.id }, data: { otpAttempts: { increment: 1 } } })
      );
      throw new UnauthorizedException('Incorrect 6-digit OTP.');
    }
    await this.prisma.withTenantTx(reqRow.organizationId, (tx) =>
      tx.supplierPcfRequest.update({ where: { id: reqRow.id }, data: { status: 'OTP_VERIFIED', otpVerifiedAt: new Date() } })
    );
    return { verified: true };
  }

  @Post(':token/submit')
  async submit(@Param('token') rawToken: string, @Body(new ZodValidationPipe(submitSchema)) body: z.infer<typeof submitSchema>) {
    const tokenHash = sha256(rawToken);
    const reqRow = await this.prisma.withTokenLookupTx('app.supplier_token_hash', tokenHash, (tx) =>
      tx.supplierPcfRequest.findUnique({ where: { tokenHash } })
    );
    if (!reqRow || !reqRow.otpVerifiedAt) throw new ForbiddenException('Email OTP verification required before submission.');
    if (reqRow.expiresAt < new Date()) throw new BadRequestException('This request link has expired.');
    if (reqRow.status !== 'OTP_VERIFIED') throw new BadRequestException('This request has already been answered.');
    const updated = await this.prisma.withTenantTx(reqRow.organizationId, (tx) =>
      tx.supplierPcfRequest.update({
        where: { id: reqRow.id },
        data: { submittedFactorVal: body.submittedFactorVal, submittedUnit: body.submittedUnit, methodologyNote: body.methodologyNote, status: 'SUBMITTED' }
      })
    );
    return { submitted: true, status: updated.status };
  }
}
