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

    const snapshot = this.store.snapshot();
    const totalOrganizations = snapshot.organizations.length;
    const activeOrganizations = snapshot.organizations.filter((o) => (o.registrationStatus ? o.registrationStatus === 'Approved' : true) && o.status !== 'Inactive').length;
    const totalUsers = snapshot.users.length;
    const activeUsers = snapshot.users.filter((u) => u.status === 'Active').length;

    return {
      status: 'Healthy',
      apiStatus: 'Operational',
      backendStatus: 'Operational',
      databaseStatus: 'Operational',
      uptime: this.formatUptime(uptimeSeconds),
      uptimeSeconds: Math.round(uptimeSeconds),
      serverLoad: `${serverLoad}%`,
      serverLoadPercent: serverLoad,
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      rssMb: Math.round(memory.rss / 1024 / 1024),
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      resourceTypesCount: snapshot.resourceTypes.filter((rt) => rt.active !== false).length,
      unitsCount: snapshot.units.filter((u) => u.active !== false).length,
      resourceCategoriesCount: snapshot.resourceCategories.filter((c) => c.active !== false).length,
      activeEmissionFactorsCount: snapshot.emissionFactors.filter((f) => f.active !== false).length,
      measuredAt: new Date().toISOString(),
    };
  }

  modules() {
    return this.store.snapshot().modules;
  }

  getSettings() {
    return this.store.snapshot().globalSettings;
  }

  updateSettings(patch: Record<string, any>) {
    const snapshot = this.store.snapshot();
    const updated = { ...snapshot.globalSettings, ...patch };
    this.store.replace({ globalSettings: updated });
    return updated;
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
