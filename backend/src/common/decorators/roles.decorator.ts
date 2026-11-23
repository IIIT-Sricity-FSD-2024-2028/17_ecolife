import { SetMetadata } from '@nestjs/common';
import { TenantRole } from '../../generated/prisma';

export const ROLES_KEY = 'tropos_roles';
export const Roles = (...roles: TenantRole[]) => SetMetadata(ROLES_KEY, roles);
