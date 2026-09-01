import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type Role = 'Super User' | 'COO' | 'Manager' | 'Analyst';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
