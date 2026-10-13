import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { OrgUser, PlatformAdmin, resolveSettings } from '../database/types';
import { checkWorkEmail, normalizeEmail, WORK_EMAIL_MESSAGES } from './email-policy';

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
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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
        renewalDate: null,
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

    const token = this.signOrgToken(owner);
    return { organization, user: this.sanitizeOrgUser(owner), token };
  }

  // ---------------------------------------------------------------------
  // Org portal login
  // ---------------------------------------------------------------------
  async loginOrgUser(dto: LoginDto) {
    const email = normalizeEmail(dto.email);

    // Emails are unique going forward, but a data.json written before that
    // rule may still hold duplicates, so check every active match and take
    // the one whose password fits instead of silently picking the first.
    const candidates = this.db.store.orgUsers.filter((u) => u.email.toLowerCase() === email && u.isActive);
    const lockedCandidate = candidates.find((c) => this.isLocked(c));
    if (lockedCandidate) throw new UnauthorizedException(this.lockedMessage(lockedCandidate));
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
    if (org.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your organization has been suspended.');
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

    const token = this.signOrgToken(user);
    return { user: this.sanitizeOrgUser(user), token };
  }

  // ---------------------------------------------------------------------
  // Admin portal login — separate table, separate secret
  // ---------------------------------------------------------------------
  async loginPlatformAdmin(dto: LoginDto) {
    const admin = this.db.store.platformAdmins.find((a) => a.email.toLowerCase() === normalizeEmail(dto.email) && a.isActive);
    if (!admin) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (this.isLocked(admin)) throw new UnauthorizedException(this.lockedMessage(admin));

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

    const token = this.jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      {
        secret: this.config.get('JWT_ADMIN_SECRET'),
        expiresIn: `${this.db.store.platformSettings.defaultSessionTimeoutMin}m`,
      },
    );

    const { passwordHash, ...safe } = admin;
    return { user: safe, token };
  }

  // ---------------------------------------------------------------------
  // Password reset — token-based, mocked email delivery (this project is
  // not deployed, so the reset link is logged rather than actually emailed).
  // ---------------------------------------------------------------------
  forgotPassword(dto: ForgotPasswordDto, portal: 'org' | 'platform') {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString(); // 30 min

    if (portal === 'org') {
      const user = this.db.store.orgUsers.find((u) => u.email.toLowerCase() === normalizeEmail(dto.email) && u.isActive);
      if (user) {
        this.db.store.passwordResetTokens.push({
          id: this.db.id(),
          token,
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
        this.db.store.passwordResetTokens.push({
          id: this.db.id(),
          token,
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

  async resetPassword(dto: ResetPasswordDto) {
    const record = this.db.store.passwordResetTokens.find((t) => t.token === dto.token);

    if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.saltRounds);

    if (record.orgUserId) {
      const user = this.db.store.orgUsers.find((u) => u.id === record.orgUserId);
      if (user) {
        user.passwordHash = passwordHash;
        user.passwordChangedAt = this.db.now();
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
  // Helpers
  // ---------------------------------------------------------------------

  private signOrgToken(user: OrgUser) {
    const org = this.db.store.organizations.find((o) => o.id === user.organizationId);
    const platformDefault = this.db.store.platformSettings.defaultSessionTimeoutMin;
    // Org can only tighten the platform default, never loosen it.
    const effectiveMinutes =
      org?.sessionTimeoutOverrideMin != null
        ? Math.min(org.sessionTimeoutOverrideMin, platformDefault)
        : platformDefault;

    return this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
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

  private lockedMessage(target: { lockedUntil?: string | null }): string {
    const minutes = Math.max(1, Math.ceil((new Date(target.lockedUntil!).getTime() - Date.now()) / 60000));
    return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`;
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
    return safe;
  }

  /** Stands in for a real transactional email provider — logs the link
   * instead of sending it, since this project is not being deployed. */
  private mockSendResetEmail(email: string, token: string) {
    const resetLink = `${this.config.get('FRONTEND_ORIGIN')}/reset-password?token=${token}`;
    this.logger.log(`[MOCK EMAIL] Password reset for ${email}: ${resetLink}`);
  }
}
