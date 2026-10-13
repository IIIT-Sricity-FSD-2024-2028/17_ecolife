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
  @OrgAuth('CONTRIBUTOR', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Respond to and resolve an alert (Contributor or Org Admin)' })
  respond(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondToAlertDto) {
    const response = this.service.respond(user, id, dto);
    return { message: 'Alert resolved.', data: response };
  }
}
