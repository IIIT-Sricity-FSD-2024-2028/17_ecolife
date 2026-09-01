import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiLoggerMiddleware } from './common/middleware/api-logger.middleware';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { RolesGuard } from './common/guards/roles.guard';
import { CommonModule } from './common/common.module';
import { SyncModule } from './sync/sync.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { SystemModule } from './system/system.module';
import { ResourcesModule } from './resources/resources.module';
import { FactorsModule } from './factors/factors.module';
import { ResourceRecordsModule } from './resource-records/resource-records.module';
import { CalculationsModule } from './calculations/calculations.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ImportsModule } from './imports/imports.module';
import { RevenueModule } from './revenue/revenue.module';

@Module({
  imports: [
    CommonModule,
    SyncModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    DepartmentsModule,
    SubmissionsModule,
    ReportsModule,
    AlertsModule,
    NotificationsModule,
    AuditModule,
    SystemModule,
    ResourcesModule,
    FactorsModule,
    ResourceRecordsModule,
    CalculationsModule,
    EvidenceModule,
    ImportsModule,
    RevenueModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})

export class AppModule implements NestModule {
  /**
   * Router-level middleware configuration.
   *
   * Three distinct route groups, each with a specific middleware stack:
   *
   *  Group 1 — Auth routes (/api/auth/*)
   *    Middleware: ApiLoggerMiddleware only.
   *    Rationale: Login/registration endpoints must log attempts for the audit
   *    trail but should NOT be rate-limited the same way as API data routes
   *    (users need to be able to retry login on wrong password).
   *
   *  Group 2 — File upload routes (/api/evidence/upload, /api/imports/upload)
   *    Middleware: ApiLoggerMiddleware only (file validation handled in controller
   *    via multer FileInterceptor; adding rate limiter would block large uploads).
   *    Rationale: Upload endpoints have their own size/type restrictions via
   *    the multer middleware config in file-upload.middleware.ts.
   *
   *  Group 3 — All remaining API routes
   *    Middleware: ApiLoggerMiddleware + RateLimiterMiddleware.
   *    Rationale: All data read/write routes are protected against abuse by
   *    the IP-based rate limiter (120 req/min).
   */
  configure(consumer: MiddlewareConsumer) {
    // Group 1: Authentication routes — logging only
    consumer
      .apply(ApiLoggerMiddleware)
      .forRoutes({ path: 'auth/*path', method: RequestMethod.ALL });

    // Group 2: File upload routes — logging only (multer handles size & type restrictions)
    consumer
      .apply(ApiLoggerMiddleware)
      .forRoutes(
        { path: 'evidence/upload', method: RequestMethod.POST },
        { path: 'imports/upload',  method: RequestMethod.POST },
      );

    // Group 3: All other API routes — logging + rate limiting (excluding auth & upload routes)
    consumer
      .apply(RateLimiterMiddleware)
      .exclude(
        { path: 'auth/*path', method: RequestMethod.ALL },
        { path: 'evidence/upload', method: RequestMethod.POST },
        { path: 'imports/upload',  method: RequestMethod.POST },
      )
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    consumer
      .apply(ApiLoggerMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}

