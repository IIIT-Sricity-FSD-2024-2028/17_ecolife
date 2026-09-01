import { Body, Controller, Get, Headers, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SnapshotDto } from '../common/base.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { ok } from '../common/crud.types';
import { RorizonDb } from '../in-memory/entities';
import { SyncService } from './sync.service';

@ApiTags('database snapshot')
@Controller('db')
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  @Roles('Super User', 'COO', 'Manager', 'Analyst')
  @ApiOperation({ summary: 'Read the full in-memory runtime snapshot for frontend synchronization.' })
  @ApiHeader({ name: 'x-role', description: 'Role reading synchronized UI state.', required: true })
  getSnapshot(@Headers('x-role') role: string, @Headers('x-user-id') userId?: string) {
    return ok('Database snapshot loaded.', this.syncService.snapshot(role, userId));
  }

  @Put('snapshot')
  @Roles('Super User', 'COO', 'Manager', 'Analyst')
  @ApiOperation({ summary: 'Replace or update in-memory runtime snapshot for active user session.' })
  @ApiHeader({ name: 'x-role', description: 'Role required for runtime snapshot synchronization.', required: true })
  replaceSnapshot(@Body() body: SnapshotDto) {
    return ok('Database snapshot synchronized.', this.syncService.replace(body as Partial<RorizonDb>));
  }
}
