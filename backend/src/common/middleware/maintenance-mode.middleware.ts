import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DbService } from '../../database/db.service';

/**
 * Router-level middleware applied only to org-scoped routes (see
 * AppModule.configure()). Blocks requests when either the platform-wide
 * flag or the requesting user's own organization flag is on.
 */
@Injectable()
export class MaintenanceModeMiddleware implements NestMiddleware {
  constructor(private readonly db: DbService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (this.db.store.platformSettings.maintenanceMode) {
      const custom = this.db.store.platformSettings.maintenanceMessage?.trim();
      throw new ServiceUnavailableException(
        custom || 'Tropos is currently undergoing platform-wide maintenance. Please try again shortly.',
      );
    }

    const orgId = (req as any).user?.organizationId;
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
}
