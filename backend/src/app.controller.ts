import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get('health')
  @ApiExcludeEndpoint()
  health() {
    return { message: 'OK', data: { status: 'healthy', timestamp: new Date().toISOString() } };
  }
}
