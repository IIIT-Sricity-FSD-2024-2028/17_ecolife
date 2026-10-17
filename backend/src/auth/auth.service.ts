import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto } from './dto/password-reset.dto';
import { OrgUser, PasswordResetToken, PlatformAdmin, resolveSettings } from '../database/types';
import { checkWorkEmail, normalizeEmail, WORK_EMAIL_MESSAGES } from './email-policy';

// Compared against when an email is unknown, so "no such account" takes about as long as "wrong password".
// Demo-mode reset codes: 6 digits, 10 minutes, burned after 5 wrong guesses.
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const DUMMY_HASH = bcrypt.hashSync('tropos-timing-equalizer', 10);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'org'
  );
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private purgeTimer?: NodeJS.Timeout;
  private readonly saltRounds: number;

  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {
    this.saltRounds = Number(this.config.get('BCRYPT_SALT_ROUNDS') ?? 10);
  }

  // ---------------------------------------------------------------------
  // Organization self-service signup
  // ---------------------------------------------------------------------
  async registerOrganization(dto: RegisterOrganizationDto) {
    if (this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. New registrations are temporarily disabled. Please try again shortly.',
      );
    }

    if (!resolveSettings(this.db.store.platformSettings).allowRegistration) {
      throw new ForbiddenException('New organization sign-ups are currently closed. Please contact the Tropos team.');
    }

    const email = normalizeEmail(dto.email);

    // 1. Basic organization screening: must be a work email, not a personal
    //    or disposable address. Can be switched off for local testing with
    //    ENFORCE_WORK_EMAIL=false.
    if (this.workEmailEnforced()) {
      const check = checkWorkEmail(email);
      if (!check.ok) {
        const message = WORK_EMAIL_MESSAGES[check.reason];
        throw new BadRequestException({ message, errors: [{ field: 'email', message }] });
      }
    }

    // 1b. An earlier sign-up with this address that was never verified must not
    //     block the real owner of the address: discard it (it has no data, it
    //     could never sign in).
    this.purgeAbandonedSignups();
    this.purgeUnverifiedSignup(email);

    // 2. One account per email address, across the whole platform. Login
    //    finds users by email alone, so a duplicate would make one of the two
    //    accounts impossible to sign in to.
    if (this.isEmailTaken(email)) {
      const message = 'An account with this email already exists. Try signing in or resetting your password.';
      throw new ConflictException({ message, errors: [{ field: 'email', message }] });
    }

    const baseSlug = slugify(dto.organizationName);
    let slug = baseSlug;
    let attempt = 1;
    while (this.db.store.organizations.some((o) => o.slug === slug)) {
      slug = `${baseSlug}-${++attempt}`;
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);
    const now = this.db.now();

    const organization = {
      id: this.db.id(),
      name: dto.organizationName,
      slug,
      status: 'TRIAL' as const,
      maintenanceMode: false,
      sessionTimeoutOverrideMin: null,
      carbonPricePerTon: 0,
      currency: 'USD',
      baselineYear: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.organizations.push(organization);

    const owner: OrgUser = {
      id: this.db.id(),
      organizationId: organization.id,
      email,
      passwordHash,
      // Email delivery is not a current product capability. Self-service
      // registration creates an immediately usable account instead.
      emailVerifiedAt: now,
      fullName: dto.fullName,
      role: 'ORG_ADMIN',
      isOwner: true,
      isActive: true,
      departmentId: null,
      invitedById: null,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
    };
    this.db.store.orgUsers.push(owner);

    // Assign the lowest-priced active plan as a trial default, if one exists.
    const trialPlan = [...this.db.store.plans]
      .filter((p) => p.isActive)
      .sort((a, b) => a.priceMonthly - b.priceMonthly)[0];

    if (trialPlan) {
      this.db.store.subscriptions.push({
        id: this.db.id(),
        organizationId: organization.id,
        planId: trialPlan.id,
        status: 'TRIAL',
        cycle: 'MONTHLY',
        startDate: now,
        renewalDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        cancelledAt: null,
        updatedAt: now,
      });
    }

    this.db.persist();

    this.auditLog.log({
      organizationId: organization.id,
      orgUserId: owner.id,
      action: 'organization.registered',
      entityType: 'organization',
      entityId: organization.id,
      metadata: { emailDomain: email.slice(email.lastIndexOf('@') + 1) },
    });

    return { organization, user: this.sanitizeOrgUser(owner), verificationRequired: false };
  }

  // ---------------------------------------------------------------------
  // Org portal login
  // ---------------------------------------------------------------------
  async loginOrgUser(dto: LoginDto) {
    if (this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. Organization sign-in is temporarily unavailable. Please try again shortly.',
      );
    }

    const email = normalizeEmail(dto.email);

    // Emails are unique going forward, but a data.json written before that
    // rule may still hold duplicates, so check every active match and take
    // the one whose password fits instead of silently picking the first.
    const candidates = this.db.store.orgUsers.filter((u) => u.email.toLowerCase() === email && u.isActive && !u.deletedAt);
    if (candidates.length === 0) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid email or password.');
    }
    const lockedCandidate = candidates.find((c) => this.isLocked(c));
    // A locked account answers exactly like a wrong password, so the response never confirms the account exists.
    if (lockedCandidate) throw new UnauthorizedException('Invalid email or password.');
    let user: OrgUser | undefined;
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
    }
    if (!user) {
      for (const c of candidates) {
        this.recordFailedLogin(c, { organizationId: c.organizationId, orgUserId: c.id, entityType: 'org_user' });
      }
      throw new UnauthorizedException('Invalid email or password.');
    }

    const org = this.db.store.organizations.find((o) => o.id === user!.organizationId);
    if (!org) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (org.maintenanceMode) {
      throw new ServiceUnavailableException('Your organization is currently in maintenance mode. Please try again shortly.');
    }
    if (org.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your organization has been suspended.');
    }
    if (org.status === 'DELETED') {
      throw new UnauthorizedException('This organization has been scheduled for deletion and is no longer accessible.');
    }

    this.clearLockout(user);
    user.lastLogin = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.id,
      action: 'auth.login',
      entityType: 'org_user',
      entityId: user.id,
    });

    const token = this.signOrgToken(user, dto.remember);
    return { user: this.sanitizeOrgUser(user), token };
  }

  // ---------------------------------------------------------------------
  // Admin portal login — separate table, separate secret
  // ---------------------------------------------------------------------
  async loginPlatformAdmin(dto: LoginDto) {
    const admin = this.db.store.platformAdmins.find((a) => a.email.toLowerCase() === normalizeEmail(dto.email) && a.isActive);
    if (!admin) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (this.isLocked(admin)) throw new UnauthorizedException('Invalid email or password.');

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) {
      this.recordFailedLogin(admin, { platformAdminId: admin.id, entityType: 'platform_admin' });
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.clearLockout(admin);
    admin.lastLogin = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.id,
      action: 'auth.admin_login',
      entityType: 'platform_admin',
      entityId: admin.id,
    });

    const token = this.signAdminToken(admin, dto.remember);

    const { passwordHash, ...safe } = admin;
    void passwordHash;
    return { user: safe, token };
  }

  // ---------------------------------------------------------------------
  // Password reset — token-based, mocked email delivery (this project is
  // not deployed, so the reset link is logged rather than actually emailed).
  // ---------------------------------------------------------------------
  /**
   * DEMO ONLY. While there is no real mailer, the reset code is returned in the API response and shown
   * on screen (a stand-in inbox). Anyone who knows an email can reset that account, so this is switched
   * on explicitly with DEMO_OTP_RESET=true and can never be active when NODE_ENV=production.
   */
  private demoOtpEnabled(): boolean {
    return this.config.get('DEMO_OTP_RESET') === 'true' && this.config.get('NODE_ENV') !== 'production';
  }

  private otpHash(portal: 'org' | 'platform', email: string, code: string) {
    return hashToken(`otp:${portal}:${normalizeEmail(email)}:${code}`);
  }

  private issueDemoOtp(dto: ForgotPasswordDto, portal: 'org' | 'platform') {
    const code = String(randomInt(100000, 1000000));
    const owner =
      portal === 'org'
        ? this.db.store.orgUsers.find((u) => u.email.toLowerCase() === normalizeEmail(dto.email) && u.isActive)
        : this.db.store.platformAdmins.find((a) => a.email.toLowerCase() === normalizeEmail(dto.email) && a.isActive);
    if (owner) {
      this.retireOldResetTokens(portal === 'org' ? { orgUserId: owner.id } : { platformAdminId: owner.id });
      this.db.store.passwordResetTokens.push({
        id: this.db.id(),
        token: this.otpHash(portal, dto.email, code),
        orgUserId: portal === 'org' ? owner.id : null,
        platformAdminId: portal === 'platform' ? owner.id : null,
        expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        usedAt: null,
        createdAt: this.db.now(),
        kind: 'otp',
        attempts: 0,
      });
      this.db.persist();
    }
    // An unknown email gets a random code too, so the response looks identical either way.
    return {
      message: 'Demo mode: your reset code is shown on screen.',
      data: { demoCode: code, expiresInMinutes: OTP_TTL_MS / 60000 },
    };
  }

  forgotPassword(dto: ForgotPasswordDto, portal: 'org' | 'platform') {
    if (portal === 'org' && this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. Password services are temporarily unavailable.',
      );
    }

    if (this.demoOtpEnabled()) return this.issueDemoOtp(dto, portal);

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token); // only the hash is stored; the raw token exists only in the email
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString(); // 30 min

    if (portal === 'org') {
      const user = this.db.store.orgUsers.find((u) => u.email.toLowerCase() === normalizeEmail(dto.email) && u.isActive);
      if (user) {
        this.retireOldResetTokens({ orgUserId: user.id });
        this.db.store.passwordResetTokens.push({
          id: this.db.id(),
          token: tokenHash,
          orgUserId: user.id,
          platformAdminId: null,
          expiresAt,
          usedAt: null,
          createdAt: this.db.now(),
        });
        this.db.persist();
        this.mockSendResetEmail(dto.email, token);
      }
    } else {
      const admin = this.db.store.platformAdmins.find((a) => a.email.toLowerCase() === normalizeEmail(dto.email) && a.isActive);
      if (admin) {
        this.retireOldResetTokens({ platformAdminId: admin.id });
        this.db.store.passwordResetTokens.push({
          id: this.db.id(),
          token: tokenHash,
          orgUserId: null,
          platformAdminId: admin.id,
          expiresAt,
          usedAt: null,
          createdAt: this.db.now(),
        });
        this.db.persist();
        this.mockSendResetEmail(dto.email, token);
      }
    }

    // Same response whether or not the email exists, so we never leak
    // which addresses are registered.
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  /** Demo-mode code check. Bound to email + portal, limited guesses, generic error for every failure. */
  private findOtpRecord(dto: ResetPasswordDto, portal: 'org' | 'platform') {
    const invalid = new BadRequestException('That code is invalid or has expired. Request a new one.');
    if (!this.demoOtpEnabled() || !dto.email || !dto.code) throw invalid;

    const owner =
      portal === 'org'
        ? this.db.store.orgUsers.find((u) => u.email.toLowerCase() === normalizeEmail(dto.email!) && u.isActive)
        : this.db.store.platformAdmins.find((a) => a.email.toLowerCase() === normalizeEmail(dto.email!) && a.isActive);
    const record = owner
      ? this.db.store.passwordResetTokens.find(
          (t) => t.kind === 'otp' && !t.usedAt && (portal === 'org' ? t.orgUserId === owner.id : t.platformAdminId === owner.id),
        )
      : undefined;
    if (!record || new Date(record.expiresAt) < new Date()) throw invalid;

    if (record.token !== this.otpHash(portal, dto.email, dto.code)) {
      record.attempts = (record.attempts ?? 0) + 1;
      if (record.attempts >= MAX_OTP_ATTEMPTS) record.usedAt = this.db.now(); // burned
      this.db.persist();
      throw invalid;
    }
    return record;
  }

  async resetPassword(dto: ResetPasswordDto, portal: 'org' | 'platform') {
    if (portal === 'org' && this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. Password services are temporarily unavailable.',
      );
    }

    let record: PasswordResetToken | undefined;
    if (dto.token) {
      const tokenHash = hashToken(dto.token);
      record = this.db.store.passwordResetTokens.find((t) => t.token === tokenHash && t.kind !== 'otp');
      if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
        throw new BadRequestException('This reset link is invalid or has expired.');
      }
    } else {
      record = this.findOtpRecord(dto, portal);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    if (record.orgUserId) {
      const user = this.db.store.orgUsers.find((u) => u.id === record.orgUserId);
      if (user) {
        user.passwordHash = passwordHash;
        user.passwordChangedAt = this.db.now();
        // An emailed link proves ownership of the inbox; an on-screen demo code does not.
        if (record.kind !== 'otp' && user.emailVerifiedAt === null) user.emailVerifiedAt = this.db.now();
        this.clearLockout(user);
      }
    } else if (record.platformAdminId) {
      const admin = this.db.store.platformAdmins.find((a) => a.id === record.platformAdminId);
      if (admin) {
        admin.passwordHash = passwordHash;
        admin.passwordChangedAt = this.db.now();
        this.clearLockout(admin);
      }
    }

    record.usedAt = this.db.now();
    this.db.persist();

    return { message: 'Password has been reset successfully.' };
  }

  // ---------------------------------------------------------------------
  // Email verification — same pattern as password reset: random token, only
  // its SHA-256 hash stored, 24h expiry, single use, newest link wins.
  // ---------------------------------------------------------------------
  onModuleInit() {
    // Hourly sweep of sign-ups that were never verified; unref so it never keeps the process alive.
    this.purgeTimer = setInterval(() => this.purgeAbandonedSignups(), 60 * 60 * 1000);
    this.purgeTimer.unref();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = hashToken(dto.token);
    const record = this.db.store.emailVerificationTokens.find((t) => t.token === tokenHash);
    if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired. Request a new one from the sign-in page.');
    }
    const user = this.db.store.orgUsers.find((u) => u.id === record.orgUserId);
    if (!user) throw new BadRequestException('This verification link is invalid or has expired. Request a new one from the sign-in page.');

    const now = this.db.now();
    if (user.emailVerifiedAt === null) user.emailVerifiedAt = now;
    record.usedAt = now;
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.id,
      action: 'auth.email_verified',
      entityType: 'org_user',
      entityId: user.id,
    });
    return { message: 'Email verified. You can now sign in.' };
  }

  resendVerification(dto: ResendVerificationDto) {
    const email = normalizeEmail(dto.email);
    const user = this.db.store.orgUsers.find((u) => u.email.toLowerCase() === email && u.isActive && u.emailVerifiedAt === null);
    if (user) this.issueVerificationEmail(user);
    // Same response whether or not the address exists or is already verified.
    return { message: 'If that address is waiting for verification, a new link has been sent.' };
  }

  private issueVerificationEmail(user: OrgUser) {
    const now = this.db.now();
    for (const t of this.db.store.emailVerificationTokens) {
      if (t.orgUserId === user.id && !t.usedAt) t.usedAt = now; // newest link wins
    }
    const token = randomBytes(32).toString('hex');
    this.db.store.emailVerificationTokens.push({
      id: this.db.id(),
      token: hashToken(token),
      orgUserId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 h
      usedAt: null,
      createdAt: now,
    });
    this.db.persist();
    this.mockSendVerificationEmail(user.email, token);
  }

  /** Removes an earlier sign-up for this address that never verified (it has no data and could not sign in). */
  private purgeUnverifiedSignup(email: string) {
    const stale = this.db.store.orgUsers.find((u) => u.email.toLowerCase() === email && u.isOwner && u.emailVerifiedAt === null);
    if (stale) this.discardUnverifiedOwner(stale);
  }

  /** Housekeeping, run on each sign-up: drops owners who never verified within 7 days. */
  private purgeAbandonedSignups() {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const abandoned = this.db.store.orgUsers.filter(
      (u) => u.isOwner && u.emailVerifiedAt === null && new Date(u.createdAt).getTime() < cutoff,
    );
    for (const u of abandoned) this.discardUnverifiedOwner(u);
  }

  private discardUnverifiedOwner(owner: OrgUser) {
    const store = this.db.store;
    const orgId = owner.organizationId;
    // Only discard it if the organization holds nothing but this one unverified owner.
    if (store.orgUsers.some((u) => u.organizationId === orgId && u.id !== owner.id)) return;
    store.orgUsers = store.orgUsers.filter((u) => u.id !== owner.id);
    store.emailVerificationTokens = store.emailVerificationTokens.filter((t) => t.orgUserId !== owner.id);
    store.subscriptions = store.subscriptions.filter((sub) => sub.organizationId !== orgId);
    store.organizations = store.organizations.filter((o) => o.id !== orgId);
    this.auditLog.log({
      action: 'organization.unverified_signup_discarded',
      entityType: 'organization',
      entityId: orgId,
    });
    this.db.persist();
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  signOrgToken(user: OrgUser, remember = false) {
    const org = this.db.store.organizations.find((o) => o.id === user.organizationId);
    const platformDefault = this.db.store.platformSettings.defaultSessionTimeoutMin || 720;
    // Org can only tighten the platform default, never loosen it.
    const baseMinutes =
      org?.sessionTimeoutOverrideMin != null
        ? Math.min(org.sessionTimeoutOverrideMin, platformDefault)
        : platformDefault;

    // When remember me is checked, token is valid for 7 days (10080 min); otherwise standard 12 hours (720 min)
    const effectiveMinutes = remember ? Math.max(baseMinutes, 7 * 24 * 60) : baseMinutes;

    return this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
        departmentId: user.departmentId,
        isOwner: user.isOwner,
      },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: `${effectiveMinutes}m`,
      },
    );
  }

  /** Only the newest reset link for an account should work. */
  private retireOldResetTokens(owner: { orgUserId?: string; platformAdminId?: string }) {
    const now = this.db.now();
    for (const t of this.db.store.passwordResetTokens) {
      if (t.usedAt) continue;
      if ((owner.orgUserId && t.orgUserId === owner.orgUserId) || (owner.platformAdminId && t.platformAdminId === owner.platformAdminId)) {
        t.usedAt = now;
      }
    }
  }

  signAdminToken(admin: PlatformAdmin, remember = false) {
    const baseMinutes = this.db.store.platformSettings.defaultSessionTimeoutMin || 720;
    const effectiveMinutes = remember ? Math.max(baseMinutes, 7 * 24 * 60) : baseMinutes;
    return this.jwt.sign(
      { sub: admin.id, email: admin.email, fullName: admin.fullName, role: admin.role },
      {
        secret: this.config.get('JWT_ADMIN_SECRET'),
        expiresIn: `${effectiveMinutes}m`,
      },
    );
  }

  private isEmailTaken(email: string): boolean {
    return this.db.store.orgUsers.some((u) => u.email.toLowerCase() === email);
  }

  private workEmailEnforced(): boolean {
    // Controlled from the admin Settings page; ENFORCE_WORK_EMAIL=false is only
    // the starting value for a store whose setting has never been saved.
    return resolveSettings(this.db.store.platformSettings).requireWorkEmail;
  }

  // ---- Account lockout --------------------------------------------------------

  private isLocked(target: { lockedUntil?: string | null }): boolean {
    return !!target.lockedUntil && new Date(target.lockedUntil) > new Date();
  }

  /** Counts a wrong password and locks the account once the limit is reached. */
  private recordFailedLogin(
    target: OrgUser | PlatformAdmin,
    audit: { organizationId?: string; orgUserId?: string; platformAdminId?: string; entityType: string },
  ) {
    const settings = resolveSettings(this.db.store.platformSettings);
    target.failedLoginCount = (target.failedLoginCount ?? 0) + 1;
    if (target.failedLoginCount >= settings.maxFailedLogins) {
      target.lockedUntil = new Date(Date.now() + settings.lockoutMinutes * 60000).toISOString();
      target.failedLoginCount = 0;
      this.auditLog.log({
        ...audit,
        action: 'auth.account_locked',
        entityId: target.id,
        metadata: { lockoutMinutes: settings.lockoutMinutes },
      });
    }
    this.db.persist();
  }

  private clearLockout(target: OrgUser | PlatformAdmin) {
    target.failedLoginCount = 0;
    target.lockedUntil = null;
  }

  private sanitizeOrgUser(user: OrgUser) {
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  private mockSendVerificationEmail(email: string, token: string) {
    const link = `${this.config.get('FRONTEND_ORIGIN')}/verify-email?token=${token}`;
    // Raw tokens are only written to the log outside production (mock mailer).
    if (this.config.get('NODE_ENV') === 'production') {
      this.logger.log(`[MOCK EMAIL] Verification email queued for ${email} (link redacted in production)`);
    } else {
      this.logger.log(`[MOCK EMAIL] Verify ${email}: ${link}`);
    }
  }

  /** Stands in for a real transactional email provider — logs the link
   * instead of sending it, since this project is not being deployed. */
  private mockSendResetEmail(email: string, token: string) {
    const resetLink = `${this.config.get('FRONTEND_ORIGIN')}/reset-password?token=${token}`;
    // Raw tokens are only written to the log outside production (mock mailer).
    if (this.config.get('NODE_ENV') === 'production') {
      this.logger.log(`[MOCK EMAIL] Password reset email queued for ${email} (link redacted in production)`);
    } else {
      this.logger.log(`[MOCK EMAIL] Password reset for ${email}: ${resetLink}`);
    }
  }

  getMaintenanceStatus() {
    return {
      maintenanceMode: !!this.db.store.platformSettings.maintenanceMode,
      message: this.db.store.platformSettings.maintenanceMessage?.trim() || null,
    };
  }
}
