import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRole } from '../../generated/prisma';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.isPlatformAdmin) return true;

    const hasRole = user.roles.some((r) => requiredRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(`Insufficient permissions. Required one of: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}

/**
 * Facility scope: users whose only operational role is Plant Manager see and change only their assigned facilities
 * (none if nothing is assigned). Every other role is organization-wide. Returns null for "all facilities".
 */
export function facilityScope(user: AuthUser): string[] | null {
  if (user.isPlatformAdmin) return null;
  if (user.roles.some((r) => r !== 'PLANT_MANAGER')) return null;
  return user.facilityIds;
}

export function assertFacilityScope(user: AuthUser, facilityId: string): boolean {
  const scope = facilityScope(user);
  return scope === null || scope.includes(facilityId);
}
