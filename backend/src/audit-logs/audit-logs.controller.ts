import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth, PlatformAuth } from '../auth/decorators/protected.decorator';
import { AuthenticatedOrgUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditLogsReadService } from './audit-logs.service';
import { AuditLogQueryDto } from './audit-logs.dto';

@ApiTags('Audit Log')
@Controller('audit-logs')
export class OrgAuditLogsController {
  constructor(private readonly service: AuditLogsReadService) {}

  @Get()
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: "Read your organization's audit log (Org Admin only)" })
  list(@CurrentUser() user: AuthenticatedOrgUser, @Query() query: AuditLogQueryDto) {
    return this.service.forOrganization(user.organizationId, query);
  }

  @Get('actions')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Distinct action names present in your audit log (for filters)' })
  actions(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.actionsFor(user.organizationId);
  }
}

@ApiTags('Audit Log')
@Controller('platform/audit-logs')
export class PlatformAuditLogsController {
  constructor(private readonly service: AuditLogsReadService) {}

  @Get()
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Read the platform-wide audit log' })
  list(@Query() query: AuditLogQueryDto) {
    return this.service.forPlatform(query);
  }

  @Get('actions')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Distinct action names present in the audit log (for filters)' })
  actions() {
    return this.service.actionsFor();
  }
}
