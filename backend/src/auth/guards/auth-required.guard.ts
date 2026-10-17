import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global safety net (deny by default). A route is only reachable if it either
 * opts out with @Public() or opts in with @OrgAuth()/@PlatformAuth() (which set
 * the roles metadata). A new endpoint added without either is refused instead
 * of silently being open to the internet.
 */
@Injectable()
export class AuthRequiredGuard implements CanActivate {
  private readonly logger = new Logger(AuthRequiredGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets) !== undefined) return true;

    this.logger.error(
      `Blocked ${context.getClass().name}.${context.getHandler().name}: no @Public() or @OrgAuth()/@PlatformAuth() declared.`,
    );
    throw new ForbiddenException('This endpoint is not available.');
  }
}
