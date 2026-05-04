import { Controller, Get } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemService } from './system.service';

@ApiTags('system')
@Controller('system')
@ApiHeader({ name: 'x-role', description: 'Super User only for system health and module status.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class SystemController {
  constructor(private readonly systemService: SystemService) {}
  @Get('health') @Roles('Super User') health() { return ok('System health loaded.', this.systemService.health()); }
  @Get('modules') @Roles('Super User') modules() { return ok('Modules loaded.', this.systemService.modules()); }
}
