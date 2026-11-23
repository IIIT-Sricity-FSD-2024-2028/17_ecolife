import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantRole } from '../../generated/prisma';

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  isPlatformAdmin: boolean;
  roles: TenantRole[];
  facilityIds: string[];
  jti?: string;
  /** Set by JwtAuthGuard from the database on every request (never trusted from the token). */
  emailVerified?: boolean;
  sessionId?: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});
