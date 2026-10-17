import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { DatabaseModule } from './database/db.module';
import { AuthModule } from './auth/auth.module';
import { DepartmentsModule } from './departments/departments.module';
import { LocationsModule } from './locations/locations.module';
import { OrgUsersModule } from './org-users/org-users.module';
import { ResourcesModule } from './resources/resources.module';
import { CalculationsModule } from './calculations/calculations.module';
import { ResourceRecordsModule } from './resource-records/resource-records.module';
import { EvidenceModule } from './evidence/evidence.module';
import { AmendmentsModule } from './amendments/amendments.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReportsModule } from './reports/reports.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { BillingModule } from './billing/billing.module';
import { ImportsModule } from './imports/imports.module';
import { ProfileModule } from './profile/profile.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlatformInsightsModule } from './platform-insights/platform-insights.module';
import { AppController } from './app.controller';
import { winstonConfig } from './common/logger/winston.config';
import { CommentsModule } from './comments/comments.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthRequiredGuard } from './auth/guards/auth-required.guard';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { MaintenanceModeMiddleware } from './common/middleware/maintenance-mode.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Fail fast with a clear message instead of the cryptic
      // "JwtStrategy requires a secret or key" when .env is missing.
      validate: (env: Record<string, unknown>) => {
        const missing = ['JWT_SECRET', 'JWT_ADMIN_SECRET'].filter((k) => !env[k]);
        if (missing.length) {
          throw new Error(
            `Missing required environment variable(s): ${missing.join(', ')}. ` +
              'Copy .env.example to .env in the backend root and fill them in.',
          );
        }
        if (env.JWT_SECRET === env.JWT_ADMIN_SECRET) {
          throw new Error('JWT_SECRET and JWT_ADMIN_SECRET must be different values.');
        }
        if (env.NODE_ENV === 'production') {
          const weak = ['JWT_SECRET', 'JWT_ADMIN_SECRET'].filter((k) => String(env[k]).length < 32);
          if (weak.length) {
            throw new Error(`${weak.join(', ')} must be at least 32 characters in production.`);
          }
        }
        return env;
      },
    }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    DepartmentsModule,
    LocationsModule,
    OrgUsersModule,
    ResourcesModule,
    CalculationsModule,
    ResourceRecordsModule,
    EvidenceModule,
    AmendmentsModule,
    AlertsModule,
    ReportsModule,
    PlatformAdminModule,
    BillingModule,
    ImportsModule,
    ProfileModule,
    AuditLogsModule,
    AnalyticsModule,
    PlatformInsightsModule,
    CommentsModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [
    // Without this, @Throttle() on individual routes is inert metadata —
    // ThrottlerGuard is what actually enforces it. Found missing during
    // verification: 6 rapid login attempts all returned 401 with none
    // ever hitting the configured 5/min limit.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Deny by default: every route must declare @Public() or @OrgAuth()/@PlatformAuth().
    { provide: APP_GUARD, useClass: AuthRequiredGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });

    consumer
      .apply(MaintenanceModeMiddleware)
      .exclude(
        { path: 'auth/{*splat}', method: RequestMethod.ALL },
        { path: 'admin-auth/{*splat}', method: RequestMethod.ALL },
        { path: 'platform/{*splat}', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.GET },
      )
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
