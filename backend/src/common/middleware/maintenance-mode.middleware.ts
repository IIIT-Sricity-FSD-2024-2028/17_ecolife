import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { DbService } from '../../database/db.service';

/**
 * Router-level middleware applied only to org-scoped routes (see
 * AppModule.configure()). Blocks requests when either the platform-wide
 * flag or the requesting user's own organization flag is on.
 *
 * Middleware runs BEFORE the route guards, so req.user does not exist yet.
 * The organization is therefore read from the bearer token directly. The
 * signature is verified; an invalid/absent token simply skips the org check
 * and the route's own guard rejects it afterwards.
 */
@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  private readonly jwt = new JwtService();

  constructor(private readonly db: DbService, private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. Please try again shortly.',
      );
    }

    const orgId = this.organizationIdFromToken(req);
    if (orgId) {
      const org = this.db.store.organizations.find((o) => o.id === orgId);
      if (org?.maintenanceMode) {
        throw new ServiceUnavailableException(
          'Your organization is currently in maintenance mode. Please try again shortly.',
        );
      }
    }

    next();
  }

  private organizationIdFromToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwt.verify<{ organizationId?: string }>(header.slice(7), {
        secret: this.config.get<string>('JWT_SECRET'),
        algorithms: ['HS256'],
      });
      return payload.organizationId;
    } catch {
      return undefined;
    }
  }
}
