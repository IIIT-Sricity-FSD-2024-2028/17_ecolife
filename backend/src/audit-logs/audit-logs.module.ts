import { Module } from '@nestjs/common';
import { AuditLogsReadService } from './audit-logs.service';
import { OrgAuditLogsController, PlatformAuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [OrgAuditLogsController, PlatformAuditLogsController],
  providers: [AuditLogsReadService],
})
export class AuditLogsModule {}
