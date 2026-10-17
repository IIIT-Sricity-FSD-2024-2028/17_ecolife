import { Body, Controller, Get, Param, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { AlertsService } from './alerts.service';
import { RespondToAlertDto } from './dto/alert.dto';

@ApiTags('Alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List alerts (Contributors see their department only)' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Post(':id/respond')
  @OrgAuth('CONTRIBUTOR', 'REVIEWER', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Respond to and resolve an alert (Contributor, Reviewer, or Org Admin)' })
  respond(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToAlertDto,
  ) {
    const response = this.service.respond(user, id, dto);
    return { message: 'Alert resolved.', data: response };
  }

  @Post(':id/acknowledge')
  @OrgAuth('REVIEWER', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Acknowledge an alert (Reviewer or Org Admin)' })
  acknowledge(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const alert = this.service.acknowledge(user, id);
    return { message: 'Alert acknowledged.', data: alert };
  }

  @Post(':id/close')
  @OrgAuth('REVIEWER', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Close/dismiss an alert (Reviewer or Org Admin)' })
  close(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comment') comment?: string,
  ) {
    const alert = this.service.close(user, id, comment);
    return { message: 'Alert closed.', data: alert };
  }
}
