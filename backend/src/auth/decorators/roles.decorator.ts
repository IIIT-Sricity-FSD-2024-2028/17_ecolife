import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as requiring one of the given roles — works for both
 * OrgRole values ('ORG_ADMIN', 'CONTRIBUTOR', ...) and PlatformRole values
 * ('SUPER_ADMIN', 'PLATFORM_ADMIN'), checked against whichever JWT
 * strategy authenticated the request.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
