import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { AuditLogService } from './audit-log.service';
import { ViewsService } from './views.service';

@Global()
@Module({
  providers: [DbService, AuditLogService, ViewsService],
  exports: [DbService, AuditLogService, ViewsService],
})
export class DatabaseModule {}
