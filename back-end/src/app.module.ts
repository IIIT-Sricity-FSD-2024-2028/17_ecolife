import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiLoggerMiddleware } from './common/middleware/api-logger.middleware';
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
  ],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiLoggerMiddleware).forRoutes('{*path}');
  }
}
