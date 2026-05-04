import { Body, Controller, Get, Put } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Read the full in-memory runtime snapshot for frontend synchronization.' })
  @ApiHeader({ name: 'x-role', description: 'Any active role can read its synchronized UI state.', required: false })
  getSnapshot() {
    return ok('Database snapshot loaded.', this.syncService.snapshot());
  }

  @Put('snapshot')
  @Roles('Super User', 'COO', 'Manager', 'Analyst')
  @ApiOperation({ summary: 'Replace in-memory runtime snapshot after a UI workflow updates state.' })
  @ApiHeader({ name: 'x-role', description: 'Role performing the synchronization write.', required: true })
  replaceSnapshot(@Body() body: SnapshotDto) {
    return ok('Database snapshot synchronized.', this.syncService.replace(body as Partial<RorizonDb>));
  }
}
