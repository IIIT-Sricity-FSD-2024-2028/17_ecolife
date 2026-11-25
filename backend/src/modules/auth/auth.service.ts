import { decryptSecret, encryptSecret, sha256 } from '../../common/utils/crypto.util';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { signJwtToken, tokenExpiry } from '../../common/guards/jwt-auth.guard';
import { buildOtpAuthUri, generateBase32Secret, generateRecoveryCodes, matchTotpStep } from '../../common/utils/totp.util';
import { TRIAL_DAYS, ALL_MODULES, TRIAL_PLAN_CODE, appLink } from '../../config/platform.constants';
import { devPreviewEnabled } from '../../config/env.validation';
import { assertPasswordPolicy } from './password-policy';
import { fyStartDateUtc, periodRow } from '../../common/utils/fiscal.util';
import { writeAuditLog } from '../../common/utils/audit.util';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Compared when the e-mail is unknown so response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('tropos-timing-equaliser', BCRYPT_COST);
const BLOCKED_ORG_STATUSES = ['SUSPENDED', 'CLOSED'];

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Signs a token and records the matching server-side session (so logout/revoke/deactivation really end it). */
  private async issueSession(
    payload: { userId: string; email: string; fullName: string; organizationId: string | null; isPlatformAdmin: boolean; roles: any[]; facilityIds: string[] },
    ip?: string,
    userAgent?: string
  ) {
    const token = signJwtToken(payload);
    const session = await this.prisma.userSession.create({
      data: {
        userId: payload.userId,
        tokenHash: sha256(token),
        ipAddress: ip || null,
        userAgent: userAgent?.slice(0, 240) || null,
        expiresAt: tokenExpiry(token)
      }
    });
    return { token, session };
  }

  private async recordFailedLogin(userId: string) {
    await this.prisma.withAuthTx({ userId }, async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { failedLoginCount: true } });
      const next = (u?.failedLoginCount ?? 0) + 1;
      if (next >= MAX_FAILED_LOGINS) {
        await tx.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } });
      } else {
        await tx.user.update({ where: { id: userId }, data: { failedLoginCount: next } });
      }
    });
  }

  private formatUserResponse(user: any) {
    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      isPlatformAdmin: user.isPlatformAdmin,
      emailVerifiedAt: user.emailVerifiedAt,
      twoFactorEnabled: user.twoFactorEnabled,
      roles: (user.roles || []).map((r: any) => r.role),
      facilityIds: (user.facilityAssignments || []).map((f: any) => f.facilityId),
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            preset: user.organization.preset,
            status: user.organization.status,
            enabledModules: user.organization.enabledModules,
            allowSingleUserMode: user.organization.allowSingleUserMode,
            cctsObligated: user.organization.cctsObligated,
            assuranceStandard: user.organization.assuranceStandard,
            planCode: user.organization.plan?.code
          }
        : null
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const found = await this.prisma.withAuthTx({ email }, (tx) =>
      tx.user.findUnique({ where: { email }, include: { organization: { include: { plan: true } } } })
    );
    if (!found) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (found.lockedUntil && found.lockedUntil > new Date()) {
      const mins = Math.max(1, Math.ceil((found.lockedUntil.getTime() - Date.now()) / 60000));
      throw new HttpException(`Too many failed sign-in attempts. Try again in ${mins} minute(s) or reset your password.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const ok = await bcrypt.compare(dto.password, found.passwordHash);
    if (!ok || !found.isActive) {
      if (found.isActive) await this.recordFailedLogin(found.id);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!found.isPlatformAdmin && found.organization && BLOCKED_ORG_STATUSES.includes(found.organization.status)) {
      throw new ForbiddenException('This organization is suspended or closed. Contact your administrator or Tropos support.');
    }

    let usedStep: number | undefined;
    let consumedRecoveryHash: string | undefined;
    if (found.twoFactorEnabled && found.twoFactorSecret) {
      if (!dto.totpCode && !dto.recoveryCode) return { requires2fa: true, email: found.email };
      if (dto.totpCode) {
        const step = matchTotpStep(decryptSecret(found.twoFactorSecret), dto.totpCode);
        // A code is single-use: reject a step at or before the last accepted one (replay).
        if (step !== null && (found.twoFactorLastStep == null || step > found.twoFactorLastStep)) usedStep = step;
      } else if (dto.recoveryCode) {
        const hash = sha256(dto.recoveryCode.trim().toUpperCase());
        if (found.recoveryCodeHashes.includes(hash)) consumedRecoveryHash = hash;
      }
      if (usedStep === undefined && !consumedRecoveryHash) {
        await this.recordFailedLogin(found.id);
        throw new UnauthorizedException('Invalid 2FA authenticator or recovery code');
      }
    }

    const { user, roles, facilityIds } = await this.prisma.withAuthTx({ userId: found.id }, async (tx) => {
      const data: any = { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null };
      if (usedStep !== undefined) data.twoFactorLastStep = usedStep;
      if (consumedRecoveryHash) data.recoveryCodeHashes = found.recoveryCodeHashes.filter((h) => h !== consumedRecoveryHash);
      const user = await tx.user.update({ where: { id: found.id }, data });
      const roleRows = await tx.userRole.findMany({ where: { userId: found.id, organizationId: found.organizationId ?? undefined } });
      const facRows = await tx.userFacilityAssignment.findMany({ where: { userId: found.id, organizationId: found.organizationId ?? undefined } });
      return { user, roles: roleRows.map((r) => r.role), facilityIds: facRows.map((f) => f.facilityId) };
    });

    const { token, session } = await this.issueSession(
      { userId: user.id, email: user.email, fullName: user.fullName, organizationId: user.organizationId, isPlatformAdmin: user.isPlatformAdmin, roles, facilityIds },
      ip,
      userAgent
    );
    await this.audit(user.id, consumedRecoveryHash ? 'LOGIN_WITH_RECOVERY_CODE' : 'LOGIN', ip);
    const formatted = this.formatUserResponse({
      ...user,
      organization: found.organization,
      roles: roles.map((role) => ({ role })),
      facilityAssignments: facilityIds.map((facilityId) => ({ facilityId }))
    });
    return { token, sessionId: session.id, user: formatted, organization: formatted.organization };
  }

  /** Security events go in the organization's audit trail (platform staff have no organization). */
  private async audit(userId: string, action: string, ip?: string) {
    const u = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUnique({ where: { id: userId }, select: { organizationId: true } }));
    if (!u?.organizationId) return;
    await this.prisma.withTenantTx(u.organizationId, (tx) => writeAuditLog(tx, { organizationId: u.organizationId!, actorId: userId, action, resourceType: 'User', resourceId: userId, ipAddress: ip }));
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.userSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit(userId, 'LOGOUT');
    return { ok: true };
  }

  async register(input: RegisterDto, ip?: string, userAgent?: string) {
    assertPasswordPolicy(input.password, input.email);
    const existing = await this.prisma.withAuthTx({ email: input.email.toLowerCase() }, (tx) => tx.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } }));
    if (existing) throw new ConflictException('An account with this email already exists');

    const starterPlan =
      (await this.prisma.plan.findFirst({
        where: { code: TRIAL_PLAN_CODE }
      })) ?? (await this.prisma.plan.findFirstOrThrow());

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const verifyRawToken = crypto.randomBytes(24).toString('hex');

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      const org = await tx.organization.create({
        data: {
          name: input.organizationName,
          industrySector: input.industrySector ?? 'Manufacturing',
          preset: 'ENTERPRISE_BRSR',
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          planId: starterPlan.id,
          billingEmail: input.email.toLowerCase(),
          enabledModules: [...ALL_MODULES],
          allowSingleUserMode: false,
          fyStartMonth: 4
        },
        include: { plan: true }
      });
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

      const now = new Date();
      const FY_START_MONTH = 4; // India's statutory financial year; stored on the organization and editable by it
      const fyStart = fyStartDateUtc(now.getUTCFullYear(), now.getUTCMonth() + 1, FY_START_MONTH);
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          planId: starterPlan.id,
          status: 'TRIALING',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      const user = await tx.user.create({
        data: { organizationId: org.id, email: input.email.toLowerCase(), fullName: input.fullName, passwordHash }
      });

      await tx.userRole.createMany({
        data: [
          { organizationId: org.id, userId: user.id, role: 'ORG_ADMIN', assignedById: user.id },
          { organizationId: org.id, userId: user.id, role: 'SUSTAINABILITY_LEAD', assignedById: user.id }
        ]
      });

      await tx.emailVerificationToken.create({
        data: { userId: user.id, tokenHash: sha256(verifyRawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      });
      await tx.emailOutbox.create({
        data: {
          organizationId: org.id,
          toEmail: user.email,
          subject: 'Verify your Tropos ERP account',
          bodyText: `Welcome to Tropos, ${user.fullName}.\n\nConfirm your email to start your trial:\n${appLink('/verify-email?token=' + verifyRawToken)}\n\nThe link works once.`,
          category: 'EMAIL_VERIFICATION',
          status: 'PENDING'
        }
      });

      const entity = await tx.entity.create({
        data: {
          organizationId: org.id,
          name: input.organizationName,
          ownershipPct: 100,
          hasOperationalControl: true,
          hasFinancialControl: true,
          effectiveFrom: fyStart,
          approvalStatus: 'APPROVED',
          approvedById: user.id
        }
      });

      const facility = await tx.facility.create({
        data: {
          organizationId: org.id,
          entityId: entity.id,
          name: `${input.city} Primary Plant`,
          facilityType: 'MANUFACTURING_PLANT',
          city: input.city,
          state: input.state,
          effectiveFrom: fyStart,
          approvalStatus: 'APPROVED',
          approvedById: user.id
        }
      });

      await tx.reportingPeriod.create({ data: periodRow(org.id, now.getUTCFullYear(), now.getUTCMonth() + 1, FY_START_MONTH) });

      // Starter defaults come from the published registry: the diesel factor, and whichever grid factor is valid today.
      const hsdFactor = await tx.emissionFactor.findFirst({ where: { organizationId: null, status: 'PUBLISHED', domain: 'FUEL', scope: 'SCOPE_1', code: { startsWith: 'FUEL_HSD' } }, orderBy: { validFrom: 'desc' } });
      const gridFactor = await tx.emissionFactor.findFirst({
        where: { organizationId: null, status: 'PUBLISHED', domain: 'ELECTRICITY_THERMAL', scope: 'SCOPE_2', regimeTag: { not: 'BEE_CCTS' }, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gte: now } }] },
        orderBy: { validFrom: 'desc' }
      });

      await tx.resourceSource.createMany({
        data: [
          {
            organizationId: org.id,
            facilityId: facility.id,
            name: 'Primary DG Set (Diesel / HSD)',
            domain: 'FUEL',
            scope: 'SCOPE_1',
            fuelCategory: 'LIQUID_FOSSIL',
            combustionPurpose: 'DG_SET',
            canonicalUnit: 'L',
            defaultFactorId: hsdFactor?.id,
            ownerId: user.id,
            effectiveFrom: fyStart
          },
          {
            organizationId: org.id,
            facilityId: facility.id,
            name: 'Main Utility Grid Meter (kWh)',
            domain: 'ELECTRICITY_THERMAL',
            scope: 'SCOPE_2',
            canonicalUnit: 'kWh',
            defaultFactorId: gridFactor?.id,
            ownerId: user.id,
            effectiveFrom: fyStart
          }
        ]
      });

      return { org, user };
    });

    const roles: ('ORG_ADMIN' | 'SUSTAINABILITY_LEAD')[] = ['ORG_ADMIN', 'SUSTAINABILITY_LEAD'];
    const { token } = await this.issueSession(
      { userId: created.user.id, email: created.user.email, fullName: created.user.fullName, organizationId: created.org.id, isPlatformAdmin: false, roles, facilityIds: [] },
      ip,
      userAgent
    );

    const formatted = this.formatUserResponse({
      ...created.user,
      organization: created.org,
      roles: roles.map((role) => ({ role })),
      facilityAssignments: []
    });

    return {
      token,
      verificationTokenDevPreview: devPreviewEnabled() ? verifyRawToken : undefined,
      user: formatted,
      organization: formatted.organization
    };
  }

  /** Runs a mail insert in the right isolation context (tenant, or platform for platform-admin users). */
  private async queueMail(organizationId: string | null, data: { toEmail: string; subject: string; bodyText: string; category: string }) {
    const row = { ...data, organizationId, status: 'PENDING' as const };
    if (organizationId) await this.prisma.withTenantTx(organizationId, (tx) => tx.emailOutbox.create({ data: row }));
    else await this.prisma.withPlatformTx((tx) => tx.emailOutbox.create({ data: row }));
  }

  async resendVerification(userId: string, email: string, organizationId: string | null) {
    const already = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } }));
    if (already?.emailVerifiedAt) return { queued: false, alreadyVerified: true };
    const recent = await this.prisma.emailVerificationToken.findFirst({ where: { userId, createdAt: { gt: new Date(Date.now() - 60 * 1000) } } });
    if (recent) throw new HttpException('A verification e-mail was just sent. Please wait a minute before requesting another.', HttpStatus.TOO_MANY_REQUESTS);
    const rawToken = crypto.randomBytes(24).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
    });
    await this.queueMail(organizationId, {
      toEmail: email,
      subject: 'Verify your Tropos ERP account',
      bodyText: `Confirm your email address:\n${appLink('/verify-email?token=' + rawToken)}`,
      category: 'EMAIL_VERIFICATION'
    });
    return { queued: true, devPreviewToken: devPreviewEnabled() ? rawToken : undefined };
  }

  async verifyEmail(token: string) {
    const rec = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new BadRequestException('Invalid or expired verification token');
    await this.prisma.withAuthTx({ userId: rec.userId }, async (tx) => {
      await tx.emailVerificationToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: rec.userId }, data: { emailVerifiedAt: new Date() } });
    });
    return { verified: true };
  }

  async forgotPassword(email: string) {
    const normalized = email.toLowerCase();
    const user = await this.prisma.withAuthTx({ email: normalized }, (tx) => tx.user.findUnique({ where: { email: normalized } }));
    let devPreviewToken: string | undefined;
    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      devPreviewToken = devPreviewEnabled() ? rawToken : undefined;
      // Only the newest reset link works.
      await this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(rawToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) }
      });
      await this.queueMail(user.organizationId, {
        toEmail: user.email,
        subject: 'Tropos Password Reset Request',
        bodyText: `Choose a new password within 60 minutes:\n${appLink('/forgot-password?token=' + rawToken)}\n\nIf you did not ask for this, ignore this email.`,
        category: 'PASSWORD_RESET'
      });
    }
    // Identical response whether or not the account exists (no account enumeration).
    return { message: 'If an active account exists for that email, a reset token has been queued.', devPreviewToken };
  }

  async resetPassword(token: string, newPassword: string) {
    const rec = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new BadRequestException('Invalid or expired reset token');
    const owner = await this.prisma.withAuthTx({ userId: rec.userId }, (tx) => tx.user.findUnique({ where: { id: rec.userId }, select: { email: true } }));
    assertPasswordPolicy(newPassword, owner?.email);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.withAuthTx({ userId: rec.userId }, async (tx) => {
      await tx.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
      await tx.userSession.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return { reset: true };
  }

  async changePassword(userId: string, currentSessionId: string | undefined, currentPassword: string, newPassword: string) {
    const user = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUniqueOrThrow({ where: { id: userId } }));
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new UnauthorizedException('Current password is incorrect');
    assertPasswordPolicy(newPassword, user.email);
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('Choose a password you have not used before.');
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.prisma.withAuthTx({ userId }, async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      // Sign out every other device; keep this one.
      await tx.userSession.updateMany({ where: { userId, revokedAt: null, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) }, data: { revokedAt: new Date() } });
    });
    await this.audit(userId, 'PASSWORD_CHANGED');
    return { changed: true };
  }

  async setup2fa(userId: string, email: string) {
    const user = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUniqueOrThrow({ where: { id: userId } }));
    // Re-running setup while 2FA is on would silently swap the secret and lock the real owner out.
    if (user.twoFactorEnabled) throw new ConflictException('Two-factor authentication is already enabled. Disable it first to set up a new authenticator.');
    const secret = generateBase32Secret(20);
    await this.prisma.withAuthTx({ userId }, (tx) => tx.user.update({ where: { id: userId }, data: { twoFactorSecret: encryptSecret(secret), twoFactorLastStep: null } }));
    return { secret, otpauthUri: buildOtpAuthUri(email, secret) };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUniqueOrThrow({ where: { id: userId } }));
    if (user.twoFactorEnabled) throw new ConflictException('Two-factor authentication is already enabled.');
    if (!user.twoFactorSecret) throw new BadRequestException('Call /2fa/setup first');
    const step = matchTotpStep(decryptSecret(user.twoFactorSecret), code);
    if (step === null) throw new BadRequestException('Invalid 6-digit authenticator code');
    const recovery = generateRecoveryCodes(8);
    await this.prisma.withAuthTx({ userId }, (tx) =>
      tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: true, recoveryCodeHashes: recovery.hashes, twoFactorLastStep: step } })
    );
    await this.audit(userId, 'TWO_FACTOR_ENABLED');
    return { enabled: true, recoveryCodes: recovery.plain };
  }

  async disable2fa(userId: string, password: string, code?: string, recoveryCode?: string) {
    const user = await this.prisma.withAuthTx({ userId }, (tx) => tx.user.findUniqueOrThrow({ where: { id: userId } }));
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Incorrect password');
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // A stolen session + password must not be enough to remove the second factor.
      const stepOk = code ? (() => { const s = matchTotpStep(decryptSecret(user.twoFactorSecret!), code); return s !== null && (user.twoFactorLastStep == null || s > user.twoFactorLastStep); })() : false;
      const recOk = recoveryCode ? user.recoveryCodeHashes.includes(sha256(recoveryCode.trim().toUpperCase())) : false;
      if (!stepOk && !recOk) throw new UnauthorizedException('Enter a current authenticator code or a recovery code to disable two-factor authentication.');
    }
    await this.prisma.withAuthTx({ userId }, (tx) =>
      tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null, recoveryCodeHashes: [], twoFactorLastStep: null } })
    );
    await this.audit(userId, 'TWO_FACTOR_DISABLED');
    return { disabled: true };
  }

  async getInvitation(rawToken: string) {
    const tokenHash = sha256(rawToken);
    const invite = await this.prisma.withTokenLookupTx('app.invite_token_hash', tokenHash, (tx) =>
      tx.invitation.findUnique({ where: { tokenHash }, include: { organization: { select: { name: true, preset: true } } } })
    );
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new NotFoundException('This invitation link no longer works. It may have expired or been cancelled. Ask your company administrator to send a new one.');
    }
    return { email: invite.email, organizationName: invite.organization.name, roles: invite.roles, expiresAt: invite.expiresAt };
  }

  async acceptInvitation(rawToken: string, fullName: string, password: string, ip?: string, userAgent?: string) {
    const tokenHash = sha256(rawToken);
    const invite = await this.prisma.withTokenLookupTx('app.invite_token_hash', tokenHash, (tx) =>
      tx.invitation.findUnique({ where: { tokenHash } })
    );
    if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('This invitation link no longer works. It may have expired or been cancelled. Ask your company administrator to send a new one.');
    }
    assertPasswordPolicy(password, invite.email);
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    let res;
    try {
      res = await this.prisma.withTenantTx(invite.organizationId, async (tx) => {
        const user = await tx.user.create({
          // Possession of the invitation link (sent to this address) proves control of the mailbox.
          data: { organizationId: invite.organizationId, email: invite.email.toLowerCase(), fullName, passwordHash, emailVerifiedAt: new Date() }
        });
        if (invite.roles.length > 0) {
          await tx.userRole.createMany({
            data: invite.roles.map((role) => ({ organizationId: invite.organizationId, userId: user.id, role, assignedById: invite.invitedById }))
          });
        }
        if (invite.facilityIds.length > 0) {
          await tx.userFacilityAssignment.createMany({
            data: invite.facilityIds.map((facilityId) => ({ organizationId: invite.organizationId, userId: user.id, facilityId, assignedById: invite.invitedById }))
          });
        }
        await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
        return user;
      });
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('A user with this email already exists');
      throw err;
    }

    const org = await this.prisma.withTenantTx(invite.organizationId, (tx) => tx.organization.findUniqueOrThrow({ where: { id: invite.organizationId }, include: { plan: true } }));
    const { token, session } = await this.issueSession(
      { userId: res.id, email: res.email, fullName: res.fullName, organizationId: invite.organizationId, isPlatformAdmin: false, roles: invite.roles, facilityIds: invite.facilityIds },
      ip,
      userAgent
    );
    const formatted = this.formatUserResponse({
      ...res,
      organization: org,
      roles: invite.roles.map((role) => ({ role })),
      facilityAssignments: invite.facilityIds.map((facilityId) => ({ facilityId }))
    });
    return { token, sessionId: session.id, accepted: true, user: formatted, organization: formatted.organization };
  }

  async me(userId: string) {
    return this.prisma.withAuthTx({ userId }, async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { organization: { include: { plan: true } }, roles: true, facilityAssignments: true }
      });
      return this.formatUserResponse({
        ...user,
        roles: user.roles.filter((r) => r.organizationId === user.organizationId),
        facilityAssignments: user.facilityAssignments.filter((f) => f.organizationId === user.organizationId)
      });
    });
  }
}
