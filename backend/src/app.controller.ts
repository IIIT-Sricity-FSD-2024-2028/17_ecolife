import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';
import { DbService } from './database/db.service';
import { getBackupStats } from './database/persistence';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly db: DbService) {}

  @Public()
  @Get('health')
  @ApiExcludeEndpoint()
  health() {
    const memory = process.memoryUsage();
    return {
      message: 'OK',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        },
        storage: {
          engine: 'in-memory-json',
          backups: getBackupStats(),
          organizationsCount: this.db.store.organizations.filter((o) => !o.deletedAt).length,
          resourceRecordsCount: this.db.store.resourceRecords.length,
        },
      },
    };
  }
}
