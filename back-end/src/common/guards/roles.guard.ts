import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const role = String(request.headers['x-role'] || '').trim();
    if (!role) throw new ForbiddenException('Missing x-role header.');
    if (!roles.includes(role as Role)) {
      throw new ForbiddenException(`Role ${role} cannot access this resource.`);
    }
    return true;
  }
}
