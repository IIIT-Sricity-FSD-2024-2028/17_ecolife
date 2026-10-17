import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { AdminUpdateSubscriptionDto, UpdatePlanDto } from './platform-insights.dto';

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
        const pricePerCycle = plan ? (sub.cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly) : 0;
        const mrr =
          sub.status === 'ACTIVE'
            ? sub.cycle === 'ANNUAL'
              ? (plan?.priceAnnual ?? 0) / 12
              : (plan?.priceMonthly ?? 0)
            : 0;

        const owner = s.orgUsers.find((u) => u.organizationId === sub.organizationId && u.isOwner);

        return {
          ...sub,
          organizationName: org?.name ?? 'Unknown',
          organizationSlug: org?.slug ?? null,
          organizationStatus: org?.status ?? null,
          ownerName: owner?.fullName ?? null,
          ownerEmail: owner?.email ?? null,
          planName: plan?.name ?? 'Unknown',
          planPriceMonthly: plan?.priceMonthly ?? 0,
          planPriceAnnual: plan?.priceAnnual ?? 0,
          pricePerCycle,
          mrr,
          invoiceCount: invoices.length,
          invoicedTotal: invoices.reduce((sum, i) => sum + i.amount, 0),
        };
      })
      .sort((a, b) => a.organizationName.localeCompare(b.organizationName));
  }

  updateSubscription(admin: AuthenticatedPlatformAdmin, id: string, dto: AdminUpdateSubscriptionDto) {
    const s = this.db.store;
    const sub = s.subscriptions.find((x) => x.id === id || x.organizationId === id);
    if (!sub) throw new NotFoundException('Subscription not found.');

    if (dto.planId && dto.planId !== sub.planId) {
      const plan = s.plans.find((p) => p.id === dto.planId);
      if (!plan) throw new NotFoundException('Plan not found.');
      sub.planId = plan.id;
    }

    if (dto.cycle) {
      sub.cycle = dto.cycle as any;
    }

    if (dto.status) {
      sub.status = dto.status as any;
    }

    if (dto.renewalDate) {
      sub.renewalDate = dto.renewalDate;
    }

    sub.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'subscription.updated',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { organizationId: sub.organizationId, ...dto },
    });

    const org = s.organizations.find((o) => o.id === sub.organizationId);
    const plan = s.plans.find((p) => p.id === sub.planId);
    const invoices = s.invoices.filter((i) => i.subscriptionId === sub.id);
    const pricePerCycle = plan ? (sub.cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly) : 0;
    const mrr =
      sub.status === 'ACTIVE'
        ? sub.cycle === 'ANNUAL'
          ? (plan?.priceAnnual ?? 0) / 12
          : (plan?.priceMonthly ?? 0)
        : 0;

    return {
      ...sub,
      organizationName: org?.name ?? 'Unknown',
      planName: plan?.name ?? 'Unknown',
      pricePerCycle,
      mrr,
      invoiceCount: invoices.length,
      invoicedTotal: invoices.reduce((sum, i) => sum + i.amount, 0),
    };
  }

  invoices() {
    const s = this.db.store;
    return s.invoices
      .map((inv) => {
        const org = s.organizations.find((o) => o.id === inv.organizationId);
        const sub = s.subscriptions.find((x) => x.id === inv.subscriptionId);
        const plan = sub ? s.plans.find((p) => p.id === sub.planId) : null;
        return {
          ...inv,
          organizationName: org?.name ?? 'Unknown',
          organizationSlug: org?.slug ?? null,
          planName: plan?.name ?? 'Standard',
        };
      })
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  plans() {
    const s = this.db.store;
    return [...s.plans]
      .sort((a, b) => a.priceMonthly - b.priceMonthly)
      .map((p) => {
        const subscribers = s.subscriptions.filter((x) => x.planId === p.id);
        const activeSubscribers = subscribers.filter((x) => x.status === 'ACTIVE');
        const planMrr = activeSubscribers.reduce(
          (sum, sub) => sum + (sub.cycle === 'ANNUAL' ? p.priceAnnual / 12 : p.priceMonthly),
          0,
        );
        return {
          ...p,
          subscribers: subscribers.length,
          activeSubscribers: activeSubscribers.length,
          planMrr,
        };
      });
  }

  updatePlan(admin: AuthenticatedPlatformAdmin, id: string, dto: UpdatePlanDto) {
    const plan = this.db.store.plans.find((p) => p.id === id);
    if (!plan) throw new NotFoundException('Plan not found.');

    if (dto.name && dto.name.trim() !== plan.name) {
      const trimmed = dto.name.trim();
      if (this.db.store.plans.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new ConflictException('Another plan already uses that name.');
      }
      plan.name = trimmed;
    }

    if (dto.isActive === false && this.db.store.plans.filter((p) => p.isActive && p.id !== id).length === 0) {
      throw new BadRequestException('At least one plan must stay active on the platform.');
    }

    // Dependency check: prevent lowering limits below what existing subscribers currently use
    const subscribers = this.db.store.subscriptions.filter((s) => s.planId === id);
    if (dto.maxUsers !== undefined && dto.maxUsers < plan.maxUsers && dto.maxUsers < 999) {
      const violatingSub = subscribers.find((sub) => {
        const users = this.db.store.orgUsers.filter((u) => u.organizationId === sub.organizationId && u.isActive).length;
        return users > dto.maxUsers!;
      });
      if (violatingSub) {
        const org = this.db.store.organizations.find((o) => o.id === violatingSub.organizationId);
        throw new BadRequestException(
          `Cannot reduce max users to ${dto.maxUsers}: subscriber "${org?.name ?? 'organization'}" already uses more active users.`,
        );
      }
    }

    if (dto.maxDepartments !== undefined && dto.maxDepartments < plan.maxDepartments && dto.maxDepartments < 999) {
      const violatingSub = subscribers.find((sub) => {
        const depts = this.db.store.departments.filter((d) => d.organizationId === sub.organizationId).length;
        return depts > dto.maxDepartments!;
      });
      if (violatingSub) {
        const org = this.db.store.organizations.find((o) => o.id === violatingSub.organizationId);
        throw new BadRequestException(
          `Cannot reduce max departments to ${dto.maxDepartments}: subscriber "${org?.name ?? 'organization'}" already uses more departments.`,
        );
      }
    }

    if (dto.description !== undefined) plan.description = dto.description.trim() || null;
    if (dto.maxDepartments !== undefined) plan.maxDepartments = dto.maxDepartments;
    if (dto.maxUsers !== undefined) plan.maxUsers = dto.maxUsers;
    if (dto.maxResourceTypes !== undefined) plan.maxResourceTypes = dto.maxResourceTypes;
    if (dto.reportFrequency !== undefined) plan.reportFrequency = dto.reportFrequency;
    if (dto.priceMonthly !== undefined) plan.priceMonthly = dto.priceMonthly;
    if (dto.priceAnnual !== undefined) plan.priceAnnual = dto.priceAnnual;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;

    this.db.persist();
    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'plan.updated',
      entityType: 'plan',
      entityId: id,
      metadata: { name: plan.name, fields: Object.keys(dto) },
    });

    const activeSubscribers = subscribers.filter((x) => x.status === 'ACTIVE');
    const planMrr = activeSubscribers.reduce(
      (sum, sub) => sum + (sub.cycle === 'ANNUAL' ? plan.priceAnnual / 12 : plan.priceMonthly),
      0,
    );
    return {
      ...plan,
      subscribers: subscribers.length,
      activeSubscribers: activeSubscribers.length,
      planMrr,
    };
  }

  deletePlan(admin: AuthenticatedPlatformAdmin, id: string) {
    const plan = this.db.store.plans.find((p) => p.id === id);
    if (!plan) throw new NotFoundException('Plan not found.');

    const subscribers = this.db.store.subscriptions.filter((x) => x.planId === id);
    if (subscribers.length > 0) {
      throw new BadRequestException(
        `Cannot delete plan "${plan.name}" because ${subscribers.length} organization(s) are actively subscribed. Please migrate or reassign their subscriptions first, or retire the plan to prevent new sign-ups.`,
      );
    }

    if (this.db.store.plans.filter((p) => p.isActive && p.id !== id).length === 0) {
      throw new BadRequestException('At least one plan must remain active on the platform.');
    }

    this.db.store.plans = this.db.store.plans.filter((p) => p.id !== id);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'plan.deleted',
      entityType: 'plan',
      entityId: id,
      metadata: { name: plan.name },
    });

    return { message: 'Plan deleted permanently.' };
  }

  // ---- Organizations (enriched list) ---------------------------------------------

  organizations() {
    const s = this.db.store;

    // Automated purge of expired soft-deleted organizations (past 30 days)
    const now = Date.now();
    const expiredIds = s.organizations
      .filter((o) => o.status === 'DELETED' && o.scheduledPurgeAt && new Date(o.scheduledPurgeAt).getTime() <= now)
      .map((o) => o.id);

    if (expiredIds.length > 0) {
      for (const id of expiredIds) {
        const orgIdx = s.organizations.findIndex((o) => o.id === id);
        if (orgIdx !== -1) {
          const deptIds = new Set(s.departments.filter((d) => d.organizationId === id).map((d) => d.id));
          s.locations = s.locations.filter((l) => !deptIds.has(l.departmentId));
          s.departments = s.departments.filter((d) => d.organizationId !== id);
          s.orgUsers = s.orgUsers.filter((u) => u.organizationId !== id);
          const recordIds = new Set(s.resourceRecords.filter((r) => r.organizationId === id).map((r) => r.id));
          s.calculationResults = s.calculationResults.filter((c) => !recordIds.has(c.resourceRecordId));
          s.amendments = s.amendments.filter((a) => !recordIds.has(a.resourceRecordId));
          s.resourceRecords = s.resourceRecords.filter((r) => r.organizationId !== id);
          s.reports = s.reports.filter((r) => r.organizationId !== id);
          s.alerts = s.alerts.filter((a) => a.organizationId !== id);
          s.targets = s.targets.filter((t) => t.organizationId !== id);
          s.emissionFactorVersions = s.emissionFactorVersions.filter((f) => f.organizationId !== id);
          const subIds = new Set(s.subscriptions.filter((sub) => sub.organizationId === id).map((sub) => sub.id));
          s.invoices = s.invoices.filter((i) => !subIds.has(i.subscriptionId));
          s.subscriptions = s.subscriptions.filter((sub) => sub.organizationId !== id);
          s.organizations.splice(orgIdx, 1);
        }
      }
      this.db.persist();
    }

    return [...s.organizations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((org) => {
        const sub = s.subscriptions.find((x) => x.organizationId === org.id);
        const plan = sub ? s.plans.find((p) => p.id === sub.planId) : null;
        const users = s.orgUsers.filter((u) => u.organizationId === org.id && !u.deletedAt);
        const owner = users.find((u) => u.isOwner);
        const lastLogin = users.map((u) => u.lastLogin).filter(Boolean).sort().pop() ?? null;
        const activeUsers = users.filter((u) => u.isActive).length;
        const activeDepts = s.departments.filter((d) => d.organizationId === org.id && !d.deletedAt).length;

        const daysUntilPurge = org.scheduledPurgeAt
          ? Math.max(0, Math.ceil((new Date(org.scheduledPurgeAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

        return {
          ...org,
          planName: plan?.name ?? null,
          maxUsers: plan?.maxUsers ?? 999,
          maxDepartments: plan?.maxDepartments ?? 999,
          subscriptionStatus: sub?.status ?? null,
          ownerName: owner?.fullName ?? null,
          ownerEmail: owner?.email ?? null,
          userCount: activeUsers,
          departmentCount: activeDepts,
          recordCount: s.resourceRecords.filter((r) => r.organizationId === org.id).length,
          lastActiveAt: lastLogin,
          locationCount: s.locations.filter((l) => s.departments.some((d) => d.id === l.departmentId && d.organizationId === org.id && !d.deletedAt)).length,
          billingCycle: sub?.cycle ?? null,
          renewalDate: sub?.renewalDate ?? null,
          daysUntilPurge,
          usersByRole: users.filter((u) => u.isActive).reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {}),
        };
      });
  }

  // ---- Catalog (read-only mirrors of the org endpoints, for admin tokens) ---------

  resourceTypes() {
    const s = this.db.store;
    return s.resourceTypes.map((t) => {
      const factors = s.emissionFactorVersions.filter((f) => f.resourceTypeId === t.id);
      const records = s.resourceRecords.filter((r) => r.resourceTypeId === t.id);
      return {
        ...t,
        globalFactorCount: factors.filter((f) => f.organizationId === null).length,
        overrideCount: factors.filter((f) => f.organizationId !== null).length,
        recordCount: records.length,
      };
    });
  }

  factorSources() {
    const s = this.db.store;
    return s.emissionFactorSources.map((src) => {
      const factors = s.emissionFactorVersions.filter((f) => f.sourceId === src.id);
      return {
        ...src,
        factorCount: factors.length,
      };
    });
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
