import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('system')
@ApiHeader({ name: 'x-role', description: 'Super User only for system health, module status, and settings.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class SystemController {
  constructor(private readonly systemService: SystemService) {}
  @Get('health') @Roles('Super User') health() { return ok('System health loaded.', this.systemService.health()); }
  @Get('modules') @Roles('Super User') modules() { return ok('Modules loaded.', this.systemService.modules()); }
  @Get('settings') @Roles('Super User') @ApiOperation({ summary: 'Read global platform settings.' }) getSettings() { return ok('Settings loaded.', this.systemService.getSettings()); }
  @Patch('settings') @Roles('Super User') @ApiOperation({ summary: 'Update global platform settings (maintenance mode, session timeout, etc.).' }) updateSettings(@Body() body: Record<string, any>) { return ok('Settings updated.', this.systemService.updateSettings(body)); }
}
