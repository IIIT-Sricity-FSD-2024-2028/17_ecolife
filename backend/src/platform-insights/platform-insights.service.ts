import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { UpdatePlanDto } from './platform-insights.dto';

const startedAt = new Date();

/** Read models and small updates for the platform admin portal. */
@Injectable()
export class PlatformInsightsService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  // ---- Dashboard ------------------------------------------------------------

  overview() {
    const s = this.db.store;
    const count = <T>(items: T[], key: (x: T) => string) =>
      items.reduce<Record<string, number>>((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {});

    const dataFile = join(process.cwd(), 'data.json');
    const dayAgo = Date.now() - 30 * 86_400_000;
    const globalFactors = s.emissionFactorVersions.filter((f) => f.organizationId === null);

    return {
      organizations: { total: s.organizations.length, byStatus: count(s.organizations, (o) => o.status) },
      people: {
        orgUsers: s.orgUsers.length,
        activeOrgUsers: s.orgUsers.filter((u) => u.isActive).length,
        platformAdmins: s.platformAdmins.filter((a) => a.isActive).length,
      },
      subscriptions: {
        byStatus: count(s.subscriptions, (x) => x.status),
        byPlan: s.plans.map((p) => ({ planId: p.id, name: p.name, subscribers: s.subscriptions.filter((x) => x.planId === p.id).length })),
      },
      activity: {
        resourceRecords: s.resourceRecords.length,
        recordsByStatus: count(s.resourceRecords, (r) => r.status),
        newRecordsLast30Days: s.resourceRecords.filter((r) => new Date(r.createdAt).getTime() >= dayAgo).length,
        reports: s.reports.length,
        openAlerts: s.alerts.filter((a) => a.status === 'OPEN').length,
      },
      factors: {
        resourceTypes: s.resourceTypes.length,
        sources: s.emissionFactorSources.length,
        globalVersions: globalFactors.length,
        orgOverrides: s.emissionFactorVersions.length - globalFactors.length,
        lockedVersions: s.emissionFactorVersions.filter((f) => f.isLocked).length,
        typesWithoutFactor: s.resourceTypes.filter((t) => t.isActive && !globalFactors.some((f) => f.resourceTypeId === t.id)).map((t) => t.name),
      },
      system: {
        maintenanceMode: s.platformSettings.maintenanceMode,
        maintenanceMessage: s.platformSettings.maintenanceMessage,
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        dataFileBytes: existsSync(dataFile) ? statSync(dataFile).size : null,
        auditLogEntries: s.auditLogs.length,
      },
    };
  }

  // ---- Subscriptions & plans ----------------------------------------------------

  subscriptions() {
    const s = this.db.store;
    return s.subscriptions
      .map((sub) => {
        const org = s.organizations.find((o) => o.id === sub.organizationId);
        const plan = s.plans.find((p) => p.id === sub.planId);
        const invoices = s.invoices.filter((i) => i.subscriptionId === sub.id);
        return {
          ...sub,
          organizationName: org?.name ?? 'Unknown',
          organizationStatus: org?.status ?? null,
          planName: plan?.name ?? 'Unknown',
          pricePerCycle: plan ? (sub.cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly) : null,
          invoiceCount: invoices.length,
          invoicedTotal: invoices.reduce((sum, i) => sum + i.amount, 0),
        };
      })
      .sort((a, b) => a.organizationName.localeCompare(b.organizationName));
  }

  plans() {
    const s = this.db.store;
    return [...s.plans]
      .sort((a, b) => a.priceMonthly - b.priceMonthly)
      .map((p) => ({ ...p, subscribers: s.subscriptions.filter((x) => x.planId === p.id).length }));
  }

  updatePlan(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdatePlanDto) {
    const plan = this.db.store.plans.find((p) => p.id === id);
    if (!plan) throw new NotFoundException('Plan not found.');
    if (dto.name && this.db.store.plans.some((p) => p.id !== id && p.name.toLowerCase() === dto.name!.toLowerCase())) {
      throw new ConflictException('Another plan already uses that name.');
    }
    if (dto.isActive === false && this.db.store.plans.filter((p) => p.isActive && p.id !== id).length === 0) {
      throw new BadRequestException('At least one plan must stay active.');
    }
    Object.assign(plan, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    if (dto.description !== undefined) plan.description = dto.description.trim() || null;
    this.db.persist();
    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'plan.updated',
      entityType: 'plan',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return { ...plan, subscribers: this.db.store.subscriptions.filter((x) => x.planId === id).length };
  }

  // ---- Organizations (enriched list) ---------------------------------------------

  organizations() {
    const s = this.db.store;
    return [...s.organizations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((org) => {
        const sub = s.subscriptions.find((x) => x.organizationId === org.id);
        const users = s.orgUsers.filter((u) => u.organizationId === org.id);
        const owner = users.find((u) => u.isOwner);
        const lastLogin = users.map((u) => u.lastLogin).filter(Boolean).sort().pop() ?? null;
        return {
          ...org,
          planName: sub ? (s.plans.find((p) => p.id === sub.planId)?.name ?? null) : null,
          subscriptionStatus: sub?.status ?? null,
          ownerName: owner?.fullName ?? null,
          ownerEmail: owner?.email ?? null,
          userCount: users.filter((u) => u.isActive).length,
          departmentCount: s.departments.filter((d) => d.organizationId === org.id).length,
          recordCount: s.resourceRecords.filter((r) => r.organizationId === org.id).length,
          lastActiveAt: lastLogin,
          locationCount: s.locations.filter((l) => s.departments.some((d) => d.id === l.departmentId && d.organizationId === org.id)).length,
          billingCycle: sub?.cycle ?? null,
          renewalDate: sub?.renewalDate ?? null,
          usersByRole: users.filter((u) => u.isActive).reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {}),
        };
      });
  }

  // ---- Catalog (read-only mirrors of the org endpoints, for admin tokens) ---------

  resourceTypes() {
    const s = this.db.store;
    return s.resourceTypes.map((t) => {
      const factors = s.emissionFactorVersions.filter((f) => f.resourceTypeId === t.id);
      return {
        ...t,
        globalFactorCount: factors.filter((f) => f.organizationId === null).length,
        overrideCount: factors.filter((f) => f.organizationId !== null).length,
      };
    });
  }

  factorSources() {
    return this.db.store.emissionFactorSources;
  }

  factorVersions(resourceTypeId: string) {
    const s = this.db.store;
    return s.emissionFactorVersions
      .filter((f) => f.resourceTypeId === resourceTypeId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
      .map((f) => ({
        ...f,
        sourceName: s.emissionFactorSources.find((x) => x.id === f.sourceId)?.name ?? 'Unknown source',
        organizationName: f.organizationId ? (s.organizations.find((o) => o.id === f.organizationId)?.name ?? 'Unknown') : null,
      }));
  }
}
