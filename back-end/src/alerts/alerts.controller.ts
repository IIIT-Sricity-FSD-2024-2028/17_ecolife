import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AlertDto, AlertResponseDto, UpdateAlertDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
@ApiHeader({ name: 'x-role', description: 'Manager/COO respond to alerts; Analyst/Super User can inspect.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}
  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Alerts loaded.', this.alertsService.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Alert loaded.', this.alertsService.find(id)); }
  @Post() @Roles('Super User', 'COO') create(@Body() dto: AlertDto) { return ok('Alert created.', this.alertsService.create(dto)); }
  @Patch(':id') @Roles('Super User', 'COO', 'Manager') update(@Param('id') id: string, @Body() dto: UpdateAlertDto) { return ok('Alert updated.', this.alertsService.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'COO', 'Manager') replace(@Param('id') id: string, @Body() dto: UpdateAlertDto) { return ok('Alert updated.', this.alertsService.update(id, dto)); }
  @Post(':id/respond') @Roles('Manager', 'COO') @ApiOperation({ summary: 'Resolve an alert with business response text.' }) respond(@Param('id') id: string, @Body() dto: AlertResponseDto) { return ok('Alert response saved.', this.alertsService.respond(id, dto.response)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Alert deleted.', this.alertsService.remove(id)); }
}
