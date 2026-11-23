import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HttpLoggerMiddleware } from './common/middleware/http-logger.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { EntriesModule } from './modules/entries/entries.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { ValueChainModule } from './modules/value-chain/value-chain.module';
import { AssuranceModule } from './modules/assurance/assurance.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { SearchModule } from './modules/search/search.module';
import { ImportsReportsModule } from './modules/imports-reports/imports-reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailOutboxModule } from './modules/email-outbox/email-outbox.module';
import { BillingModule } from './modules/billing/billing.module';
import { SupplierPortalModule } from './modules/supplier-portal/supplier-portal.module';
import { MetaModule } from './modules/meta/meta.module';
import { ExplorerModule } from './modules/explorer/explorer.module';
import { PlatformModule } from './modules/platform/platform.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    WorkspaceModule,
    EntriesModule,
    ResourcesModule,
    GovernanceModule,
    ValueChainModule,
    AssuranceModule,
    EvidenceModule,
    OcrModule,
    SearchModule,
    ImportsReportsModule,
    NotificationsModule,
    EmailOutboxModule,
    BillingModule,
    SupplierPortalModule,
    PlatformModule,
    ExplorerModule,
    MetaModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, HttpLoggerMiddleware).forRoutes('*');
  }
}
