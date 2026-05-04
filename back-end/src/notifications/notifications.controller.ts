import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationDto, UpdateNotificationDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@ApiHeader({ name: 'x-role', description: 'Any role can read own UI notifications; creators vary by workflow.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list(@Headers('x-role') role: Role) { return ok('Notifications loaded.', this.notificationsService.list(role)); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Notification loaded.', this.notificationsService.find(id)); }
  @Post() @Roles('Super User', 'COO', 'Manager', 'Analyst') create(@Body() dto: NotificationDto) { return ok('Notification created.', this.notificationsService.create(dto)); }
  @Patch(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') update(@Param('id') id: string, @Body() dto: UpdateNotificationDto) { return ok('Notification updated.', this.notificationsService.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') replace(@Param('id') id: string, @Body() dto: UpdateNotificationDto) { return ok('Notification updated.', this.notificationsService.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Notification deleted.', this.notificationsService.remove(id)); }
}
