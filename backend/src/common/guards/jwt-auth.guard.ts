import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { getEnv } from '../../config/env.validation';
import { AuthUser } from '../decorators/current-user.decorator';
import { sha256 } from '../utils/crypto.util';

export function signJwtToken(payload: AuthUser): string {
  const env = getEnv();
  // jti makes every token (and therefore every session hash) unique, even for same-second logins.
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

export function tokenExpiry(token: string): Date {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 12 * 60 * 60 * 1000);
}

const BLOCKED_ORG_STATUSES = ['SUSPENDED', 'CLOSED'];

/**
 * Verifies the JWT signature AND re-validates on every request against the database:
 * session not revoked/expired, user still active, organization not suspended/closed.
 * Roles and facility scope are re-read from the database so role changes and
 * deactivation take effect immediately instead of when the token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Authentication required');
    const raw = header.slice(7);

    let decoded: AuthUser;
    try {
      decoded = jwt.verify(raw, getEnv().JWT_SECRET) as AuthUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    const hash = sha256(raw);
    const state = await this.prisma.withAuthTx({ userId: decoded.userId }, async (tx) => {
      const session = await tx.userSession.findUnique({ where: { tokenHash: hash } });
      if (!session || session.userId !== decoded.userId || session.revokedAt || session.expiresAt < new Date()) return null;
      const user = await tx.user.findUnique({
        where: { id: decoded.userId },
        include: { roles: true, facilityAssignments: true, organization: { select: { status: true, trialEndsAt: true } } }
      });
      if (session.lastActiveAt.getTime() < Date.now() - 5 * 60 * 1000) {
        await tx.userSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
      }
      return { session, user };
    });

    if (!state || !state.user || !state.user.isActive) throw new UnauthorizedException('Session is no longer valid. Please sign in again.');
    const { user, session } = state;
    if (!user.isPlatformAdmin && user.organization && BLOCKED_ORG_STATUSES.includes(user.organization.status)) {
      throw new ForbiddenException('This organization is suspended or closed. Contact your administrator or Tropos support.');
    }
    // A lapsed free trial keeps the data readable and exportable but stops new writes until a plan is paid for.
    const org = user.organization;
    if (!user.isPlatformAdmin && org?.status === 'TRIAL' && org.trialEndsAt && org.trialEndsAt < new Date()) {
      const path = String(req.originalUrl ?? req.url ?? '');
      const allowed = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || /\/(billing|auth)(\/|\?|$)/.test(path);
      if (!allowed) throw new HttpException('Your free trial has ended. Your data is safe and can still be viewed and exported. Choose a plan under Billing to continue entering data.', HttpStatus.PAYMENT_REQUIRED);
    }
    req.user = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      isPlatformAdmin: user.isPlatformAdmin,
      roles: user.roles.filter((r) => r.organizationId === user.organizationId).map((r) => r.role),
      facilityIds: user.facilityAssignments.filter((f) => f.organizationId === user.organizationId).map((f) => f.facilityId),
      emailVerified: Boolean(user.emailVerifiedAt),
      sessionId: session.id,
      jti: decoded.jti
    } satisfies AuthUser;
    return true;
  }
}

/** Use after JwtAuthGuard on actions that send mail, spend money or create credentials. */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user?.emailVerified) throw new ForbiddenException('Verify your email address before using this feature.');
    return true;
  }
}
