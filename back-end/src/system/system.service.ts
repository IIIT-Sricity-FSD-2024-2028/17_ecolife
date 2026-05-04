import { Injectable } from '@nestjs/common';
import { InMemoryStoreService } from '../common/in-memory-store.service';

@Injectable()
export class SystemService {
  constructor(private readonly store: InMemoryStoreService) {}

  health() {
    const uptimeSeconds = process.uptime();
    const memory = process.memoryUsage();
    const heapLoad = memory.heapTotal > 0 ? Math.min((memory.heapUsed / memory.heapTotal) * 100, 100) : 0;
    const rssLoad = Math.min((memory.rss / (256 * 1024 * 1024)) * 100, 100);
    const serverLoad = Math.round((heapLoad * 0.7) + (rssLoad * 0.3));

    return {
      uptime: this.formatUptime(uptimeSeconds),
      uptimeSeconds: Math.round(uptimeSeconds),
      serverLoad: `${serverLoad}%`,
      serverLoadPercent: serverLoad,
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024),
      measuredAt: new Date().toISOString(),
    };
  }

  modules() {
    return this.store.snapshot().modules;
  }

  private formatUptime(totalSeconds: number) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}
