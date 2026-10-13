import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgRole, PlatformRole } from '../../database/types';

export interface AuthenticatedOrgUser {
  sub: string; // org user id
  email: string;
  role: OrgRole;
  organizationId: string;
  departmentId: string | null;
  isOwner: boolean;
}

export interface AuthenticatedPlatformAdmin {
  sub: string; // platform admin id
  email: string;
  role: PlatformRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedOrgUser | AuthenticatedPlatformAdmin;
  },
);
