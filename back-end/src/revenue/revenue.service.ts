import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Addon, Plan, Subscription } from '../in-memory/entities';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@Injectable()
export class RevenueService {
  constructor(private readonly store: InMemoryStoreService) {}

  // ----------------------------------------------------
  // 1. PLANS MANAGEMENT
  // ----------------------------------------------------
  listPlans(): Plan[] {
    return this.store.list<Plan>('plans');
  }

  findPlan(id: string): Plan {
    return this.store.find<Plan>('plans', id);
  }

  createPlan(dto: CreatePlanDto): Plan {
    return this.store.create<Plan>('plans', { status: 'ACTIVE', ...dto } as any, 'plan');
  }

  updatePlan(id: string, dto: UpdatePlanDto): Plan {
    return this.store.update<Plan>('plans', id, dto);
  }

  removePlan(id: string): Plan {
    // Check if plan has active subscriptions
    const subs = this.listSubscriptions();
    const isUsed = subs.some(s => s.planId === id && (s.status === 'ACTIVE' || s.status === 'TRIAL'));
    if (isUsed) {
      // Soft-deactivate to preserve historical subscription integrity
      return this.store.update<Plan>('plans', id, { status: 'INACTIVE' });
    }
    return this.store.remove<Plan>('plans', id);
  }

  // ----------------------------------------------------
  // 2. ADD-ONS MANAGEMENT
  // ----------------------------------------------------
  listAddons(): Addon[] {
    return this.store.list<Addon>('addons');
  }

  findAddon(id: string): Addon {
    return this.store.find<Addon>('addons', id);
  }

  createAddon(dto: CreateAddonDto): Addon {
    return this.store.create<Addon>('addons', { status: 'ACTIVE', ...dto } as any, 'addon');
  }

  updateAddon(id: string, dto: UpdateAddonDto): Addon {
    return this.store.update<Addon>('addons', id, dto);
  }

  removeAddon(id: string): Addon {
    const subs = this.listSubscriptions();
    const isAttached = subs.some(s => s.addonIds?.includes(id) && s.status === 'ACTIVE');
    if (isAttached) {
      return this.store.update<Addon>('addons', id, { status: 'INACTIVE' });
    }
    return this.store.remove<Addon>('addons', id);
  }

  // ----------------------------------------------------
  // 3. SUBSCRIPTIONS MANAGEMENT & LIFECYCLE
  // ----------------------------------------------------
  listSubscriptions(): Subscription[] {
    return this.store.list<Subscription>('subscriptions');
  }

  findSubscription(id: string): Subscription {
    return this.store.find<Subscription>('subscriptions', id);
  }

  removeSubscription(id: string): Subscription {
    return this.store.remove<Subscription>('subscriptions', id);
  }

  getSubscriptionForOrganization(organizationId: string): { subscription: Subscription | null; plan: Plan | null; addons: Addon[] } {
    const subs = this.listSubscriptions();
    // Prioritize ACTIVE, then TRIAL
    const activeSub = subs.find(s => s.organizationId === organizationId && s.status === 'ACTIVE') ||
                      subs.find(s => s.organizationId === organizationId && s.status === 'TRIAL') ||
                      subs.filter(s => s.organizationId === organizationId).pop() || null;
    let plan: Plan | null = null;
    // ONLY assign active plan if subscription status is ACTIVE or TRIAL
    if (activeSub && (activeSub.status === 'ACTIVE' || activeSub.status === 'TRIAL')) {
      try {
        plan = this.findPlan(activeSub.planId);
      } catch (e) {
        plan = null;
      }
    }
    const allAddons = this.listAddons();
    const attachedAddons = (activeSub && (activeSub.status === 'ACTIVE' || activeSub.status === 'TRIAL') ? (activeSub.addonIds || []) : [])
      .map(aid => allAddons.find(a => a.id === aid))
      .filter((a): a is Addon => Boolean(a && a.status === 'ACTIVE'));

    return { subscription: activeSub, plan, addons: attachedAddons };
  }

  /**
   * Single Active Subscription Business Rule Enforcement:
   * When creating or activating a new subscription for an organization,
   * any existing ACTIVE or TRIAL subscription for that organization is updated to EXPIRED/CANCELLED.
   */
  private deactivateExistingSubscriptions(organizationId: string): void {
    const subs = this.listSubscriptions();
    subs.forEach(s => {
      if (s.organizationId === organizationId && (s.status === 'ACTIVE' || s.status === 'TRIAL')) {
        this.store.update<Subscription>('subscriptions', s.id, {
          status: 'CANCELLED',
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  createSubscription(dto: CreateSubscriptionDto): Subscription {
    const status = dto.status || 'ACTIVE';
    if (status === 'ACTIVE' || status === 'TRIAL') {
      this.deactivateExistingSubscriptions(dto.organizationId);
    }
    const startDate = dto.startDate || new Date().toISOString().split('T')[0];
    const renewalDate = dto.renewalDate || this.calculateDefaultRenewal(startDate, dto.billingCycle || 'MONTHLY');
    return this.store.create<Subscription>('subscriptions', {
      startDate,
      renewalDate,
      addonIds: [],
      ...dto,
      status,
      billingCycle: dto.billingCycle || 'MONTHLY',
    } as any, 'sub');
  }

  updateSubscription(id: string, dto: UpdateSubscriptionDto): Subscription {
    const sub = this.findSubscription(id);
    if (dto.status === 'ACTIVE' && sub.status !== 'ACTIVE') {
      this.deactivateExistingSubscriptions(sub.organizationId);
    }
    return this.store.update<Subscription>('subscriptions', id, dto);
  }

  upgradeSubscription(organizationId: string, planId: string, billingCycle: 'MONTHLY' | 'ANNUAL', addonIds?: string[], customPrice?: number): Subscription {
    const plan = this.findPlan(planId);
    if (plan.status !== 'ACTIVE') {
      throw new BadRequestException(`Plan ${plan.name} is currently inactive.`);
    }
    // Deactivate previous active subscription
    this.deactivateExistingSubscriptions(organizationId);

    const startDate = new Date().toISOString().split('T')[0];
    const renewalDate = this.calculateDefaultRenewal(startDate, billingCycle);

    const newSubData: Partial<Subscription> = {
      organizationId,
      planId,
      status: 'ACTIVE',
      billingCycle,
      startDate,
      renewalDate,
      addonIds: addonIds || [],
      customPrice: planId === 'plan-enterprise' && customPrice ? customPrice : undefined,
    };

    return this.store.create<Subscription>('subscriptions', newSubData as any, 'sub');
  }

  cancelSubscription(id: string): Subscription {
    return this.store.update<Subscription>('subscriptions', id, {
      status: 'CANCELLED',
      updatedAt: new Date().toISOString(),
    });
  }

  renewSubscription(id: string): Subscription {
    const sub = this.findSubscription(id);
    const baseDate = sub.renewalDate || sub.startDate || new Date().toISOString().split('T')[0];
    const newRenewalDate = this.calculateDefaultRenewal(baseDate, sub.billingCycle || 'MONTHLY');
    return this.store.update<Subscription>('subscriptions', id, {
      status: 'ACTIVE',
      renewalDate: newRenewalDate,
      updatedAt: new Date().toISOString(),
    });
  }

  toggleAddonForOrganization(organizationId: string, addonId: string, attach: boolean): { subscription: Subscription; addons: Addon[] } {
    const { subscription } = this.getSubscriptionForOrganization(organizationId);
    if (!subscription) {
      throw new NotFoundException(`No subscription found for organization ${organizationId}.`);
    }
    const currentAddons = new Set(subscription.addonIds || []);
    if (attach) {
      currentAddons.add(addonId);
    } else {
      currentAddons.delete(addonId);
    }
    const updatedSub = this.store.update<Subscription>('subscriptions', subscription.id, {
      addonIds: Array.from(currentAddons),
      updatedAt: new Date().toISOString(),
    });
    const { addons } = this.getSubscriptionForOrganization(organizationId);
    return { subscription: updatedSub, addons };
  }

  buyExpansionPack(organizationId: string, type: 'users' | 'departments', count: number): { subscription: Subscription; usage: any } {
    return this.manageExpansionPack(organizationId, type, 'ADD', count);
  }

  manageExpansionPack(
    organizationId: string,
    type: 'users' | 'departments',
    action: 'ADD' | 'REMOVE' | 'SET',
    count: number = 1
  ): { subscription: Subscription; usage: any } {
    const { subscription, plan } = this.getSubscriptionForOrganization(organizationId);
    if (!subscription) {
      throw new NotFoundException(`No active subscription found for organization ${organizationId}.`);
    }

    const usageBefore = this.getOrganizationUsage(organizationId);
    const activeCount = type === 'users' ? usageBefore.usage.users.current : usageBefore.usage.departments.current;
    const includedCount = type === 'users' ? (plan?.maxUsers || 0) : (plan?.maxDepartments || 0);

    const currentExtra = type === 'users' ? (subscription.extraUsers || 0) : (subscription.extraDepartments || 0);
    let newExtra = currentExtra;

    if (action === 'ADD') {
      newExtra = currentExtra + count;
    } else if (action === 'REMOVE') {
      newExtra = Math.max(0, currentExtra - count);
    } else if (action === 'SET') {
      newExtra = Math.max(0, count);
    }

    // Safety check: ensure total capacity is not reduced below active provisioned count
    const maxAutoAdd = type === 'users' ? (plan?.maxAdditionalUsers || includedCount) : (plan?.maxAdditionalDepartments || includedCount);
    const projectedCapacity = includedCount + newExtra + maxAutoAdd;
    if (projectedCapacity < activeCount) {
      throw new BadRequestException(
        `Cannot reduce ${type} capacity below active workspace count (${activeCount} active ${type}). Please deactivate active accounts first.`
      );
    }

    const updateData: Partial<Subscription> = type === 'users'
      ? { extraUsers: newExtra, updatedAt: new Date().toISOString() }
      : { extraDepartments: newExtra, updatedAt: new Date().toISOString() };

    const updatedSub = this.store.update<Subscription>('subscriptions', subscription.id, updateData);
    const usage = this.getOrganizationUsage(organizationId);
    return { subscription: updatedSub, usage };
  }

  private calculateDefaultRenewal(startDateStr: string, cycle: 'MONTHLY' | 'ANNUAL'): string {
    if (!startDateStr || !/^\d{4}-\d{2}-\d{2}/.test(startDateStr)) {
      startDateStr = new Date().toISOString().split('T')[0];
    }
    const parts = startDateStr.substring(0, 10).split('-').map(Number);
    let year = parts[0];
    let month = parts[1] - 1;
    let day = parts[2];
    if (cycle === 'ANNUAL') {
      year += 1;
    } else {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  // ----------------------------------------------------
  // 4. REVENUE CALCULATIONS & DASHBOARD OVERVIEW
  // ----------------------------------------------------
  getOverview(): any {
    const db = this.store.snapshot();
    const subs = db.subscriptions || [];
    const plans = db.plans || [];
    const addons = db.addons || [];
    const orgs = db.organizations || [];

    const planMap = new Map(plans.map(p => [p.id, p]));
    const addonMap = new Map(addons.map(a => [a.id, a]));

    let totalBaseMrr = 0;
    let totalAddonMrr = 0;
    let totalAdditionalUserMrr = 0;
    let totalAdditionalDeptMrr = 0;

    const activePaidOrgs = new Set<string>();
    const planDistribution: Record<string, number> = { Starter: 0, Professional: 0, Enterprise: 0 };
    const cycleDistribution: Record<string, number> = { MONTHLY: 0, ANNUAL: 0 };
    const addonRevenueMap: Record<string, { name: string; mrr: number; count: number }> = {};

    addons.forEach(a => {
      addonRevenueMap[a.id] = { name: a.name, mrr: 0, count: 0 };
    });

    subs.forEach(sub => {
      const plan = planMap.get(sub.planId);

      // ONLY currently active subscriptions count towards current MRR, ARR, active plan distribution, and cycle distribution
      if (sub.status === 'ACTIVE') {
        if (plan && planDistribution[plan.name] !== undefined) {
          planDistribution[plan.name]++;
        }
        if (sub.billingCycle) {
          cycleDistribution[sub.billingCycle] = (cycleDistribution[sub.billingCycle] || 0) + 1;
        }

        activePaidOrgs.add(sub.organizationId);

        // Base plan MRR contribution
        let baseSubMonthly = 0;
        if (sub.customPrice !== undefined && sub.customPrice > 0) {
          baseSubMonthly = sub.billingCycle === 'ANNUAL' ? (sub.customPrice / 12) : sub.customPrice;
        } else if (plan) {
          baseSubMonthly = sub.billingCycle === 'ANNUAL' ? (plan.priceAnnual / 12) : plan.priceMonthly;
        }
        totalBaseMrr += baseSubMonthly;

        // Expansion Revenue: Additional Users / Seats (ONLY if price is configured > 0)
        const orgUsersCount = db.users.filter(u => u.organizationId === sub.organizationId).length;
        const incUsers = plan ? plan.maxUsers : 0;
        const addUsers = Math.max(0, orgUsersCount - incUsers);
        const hasUserExpansion = Boolean(plan && plan.additionalUserPriceMonthly !== undefined && plan.additionalUserPriceMonthly > 0);
        let addUsersMrr = 0;
        if (hasUserExpansion && plan) {
          const maxAddUsers = plan.maxAdditionalUsers !== undefined ? plan.maxAdditionalUsers : incUsers;
          const chargeableUsers = Math.min(addUsers, maxAddUsers);
          const userUnitPrice = plan.additionalUserPriceMonthly || 0;
          addUsersMrr = sub.billingCycle === 'ANNUAL' 
            ? (chargeableUsers * (plan.additionalUserPriceAnnual ? (plan.additionalUserPriceAnnual / 12) : userUnitPrice))
            : (chargeableUsers * userUnitPrice);
        }
        totalAdditionalUserMrr += addUsersMrr;

        // Expansion Revenue: Additional Departments / Entities (ONLY if price is configured > 0)
        const orgDeptsCount = db.departments.filter(d => d.orgId === sub.organizationId).length;
        const incDepts = plan ? plan.maxDepartments : 0;
        const addDepts = Math.max(0, orgDeptsCount - incDepts);
        const hasDeptExpansion = Boolean(plan && plan.additionalDepartmentPriceMonthly !== undefined && plan.additionalDepartmentPriceMonthly > 0);
        let addDeptsMrr = 0;
        if (hasDeptExpansion && plan) {
          const maxAddDepts = plan.maxAdditionalDepartments !== undefined ? plan.maxAdditionalDepartments : incDepts;
          const chargeableDepts = Math.min(addDepts, maxAddDepts);
          const deptUnitPrice = plan.additionalDepartmentPriceMonthly || 0;
          addDeptsMrr = sub.billingCycle === 'ANNUAL'
            ? (chargeableDepts * (plan.additionalDepartmentPriceAnnual ? (plan.additionalDepartmentPriceAnnual / 12) : deptUnitPrice))
            : (chargeableDepts * deptUnitPrice);
        }
        totalAdditionalDeptMrr += addDeptsMrr;

        // Add-ons MRR contribution
        (sub.addonIds || []).forEach(aid => {
          const addonObj = addonMap.get(aid);
          if (addonObj && addonObj.status === 'ACTIVE') {
            const addonMonthly = sub.billingCycle === 'ANNUAL' ? (addonObj.priceAnnual / 12) : addonObj.priceMonthly;
            totalAddonMrr += addonMonthly;

            if (!addonRevenueMap[aid]) {
              addonRevenueMap[aid] = { name: addonObj.name, mrr: 0, count: 0 };
            }
            addonRevenueMap[aid].mrr += addonMonthly;
            addonRevenueMap[aid].count += 1;
          }
        });
      }
    });

    const mrr = Math.round(totalBaseMrr + totalAddonMrr + totalAdditionalUserMrr + totalAdditionalDeptMrr);
    const arr = mrr * 12;
    const activeCustomerCount = activePaidOrgs.size;
    const arpc = activeCustomerCount > 0 ? Math.round(mrr / activeCustomerCount) : 0;

    return {
      mrr,
      arr,
      baseMrr: Math.round(totalBaseMrr),
      addonMrr: Math.round(totalAddonMrr),
      additionalUserMrr: Math.round(totalAdditionalUserMrr),
      additionalDepartmentMrr: Math.round(totalAdditionalDeptMrr),
      arpc, // Average Revenue Per Customer
      arpu: arpc, // Alias for backwards compatibility
      activeCustomers: activeCustomerCount,
      activeSubscriptions: subs.filter(s => s.status === 'ACTIVE').length,
      trialSubscriptions: subs.filter(s => s.status === 'TRIAL').length,
      cancelledSubscriptions: subs.filter(s => s.status === 'CANCELLED').length,
      historicalSubscriptions: subs.filter(s => s.status === 'CANCELLED' || s.status === 'EXPIRED').length,
      totalSubscriptions: subs.length,
      planDistribution,
      cycleDistribution,
      addonRevenueBreakdown: Object.values(addonRevenueMap),
      recentSubscriptions: subs.slice(-10).reverse().map(sub => {
        const plan = planMap.get(sub.planId);
        const org = orgs.find(o => o.id === sub.organizationId);
        return {
          ...sub,
          planName: plan?.name || 'Unknown',
          organizationName: org?.name || sub.organizationId,
        };
      }),
    };
  }

  // ----------------------------------------------------
  // 5. ORGANIZATION USAGE & REAL DATA COMPUTATION
  // ----------------------------------------------------
  getOrganizationUsage(organizationId: string): any {
    const db = this.store.snapshot();
    const org = db.organizations.find(o => o.id === organizationId);
    if (!org) {
      throw new NotFoundException(`Organization ${organizationId} not found.`);
    }

    const { subscription, plan, addons } = this.getSubscriptionForOrganization(organizationId);
    const isSubscriptionActive = Boolean(subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL'));

    const orgUsers = db.users.filter(u => u.organizationId === organizationId);
    const orgDepts = db.departments.filter(d => d.orgId === organizationId);
    const orgSubs = db.submissions.filter(s => s.organizationId === organizationId);
    const orgReports = db.reports.filter(r => r.organizationId === organizationId);
    const orgEvidences = db.evidences.filter(e => {
      if (e.submissionId) {
        const sub = db.submissions.find(s => s.id === e.submissionId);
        return sub?.organizationId === organizationId;
      }
      return (e as any).organizationId === organizationId;
    });

    const currentUsers = orgUsers.length;
    const currentDepartments = orgDepts.length;
    
    // STAGE 2 EXPANSION REVENUE COMPUTATION WITH PRE-PURCHASED PACKS & AUTO EXPANSION
    const prePurchasedExtraUsers = subscription?.extraUsers || 0;
    const prePurchasedExtraDepts = subscription?.extraDepartments || 0;

    const includedUsers = isSubscriptionActive && plan ? plan.maxUsers : 0;
    const additionalUsers = Math.max(0, currentUsers - includedUsers);
    const hasUserExpansion = Boolean(isSubscriptionActive && plan && plan.additionalUserPriceMonthly !== undefined && plan.additionalUserPriceMonthly > 0);
    const maxAddUsers = hasUserExpansion && plan ? (plan.maxAdditionalUsers !== undefined ? plan.maxAdditionalUsers : includedUsers) : 0;
    const chargeableAdditionalUsers = Math.max(prePurchasedExtraUsers, Math.min(additionalUsers, maxAddUsers + prePurchasedExtraUsers));
    const effectiveMaxUsers = includedUsers + maxAddUsers + prePurchasedExtraUsers;
    const userUnitPriceMonthly = hasUserExpansion && plan ? (plan.additionalUserPriceMonthly || 0) : 0;
    const additionalUserRevenue = (hasUserExpansion || prePurchasedExtraUsers > 0)
      ? (subscription?.billingCycle === 'ANNUAL'
          ? (chargeableAdditionalUsers * (plan?.additionalUserPriceAnnual ? (plan.additionalUserPriceAnnual / 12) : userUnitPriceMonthly))
          : (chargeableAdditionalUsers * userUnitPriceMonthly))
      : 0;

    const includedDepts = isSubscriptionActive && plan ? plan.maxDepartments : 0;
    const additionalDepts = Math.max(0, currentDepartments - includedDepts);
    const hasDeptExpansion = Boolean(isSubscriptionActive && plan && plan.additionalDepartmentPriceMonthly !== undefined && plan.additionalDepartmentPriceMonthly > 0);
    const maxAddDepts = hasDeptExpansion && plan ? (plan.maxAdditionalDepartments !== undefined ? plan.maxAdditionalDepartments : includedDepts) : 0;
    const chargeableAdditionalDepts = Math.max(prePurchasedExtraDepts, Math.min(additionalDepts, maxAddDepts + prePurchasedExtraDepts));
    const effectiveMaxDepts = includedDepts + maxAddDepts + prePurchasedExtraDepts;
    const deptUnitPriceMonthly = hasDeptExpansion && plan ? (plan.additionalDepartmentPriceMonthly || 0) : 0;
    const additionalDeptRevenue = (hasDeptExpansion || prePurchasedExtraDepts > 0)
      ? (subscription?.billingCycle === 'ANNUAL'
          ? (chargeableAdditionalDepts * (plan?.additionalDepartmentPriceAnnual ? (plan.additionalDepartmentPriceAnnual / 12) : deptUnitPriceMonthly))
          : (chargeableAdditionalDepts * deptUnitPriceMonthly))
      : 0;

    // REQUIREMENT #2 & #8: Count ONLY submissions created during the CURRENT CALENDAR MONTH using s.submittedAt || s.createdAt
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();

    const currentMonthSubmissions = orgSubs.filter(s => {
      const dateStr = s.submittedAt || (s as any).createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth;
    }).length;

    const currentReports = orgReports.length;

    // REQUIREMENT #3 & #4: Calculate real storage in GB using actual fileSizeBytes
    const totalBytes = orgEvidences.reduce((acc, ev) => {
      const bytes = Number(ev.fileSizeBytes) || Number((ev as any).sizeBytes) || Number((ev as any).size) || 0;
      return acc + bytes;
    }, 0);
    const currentStorage = Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3));

    // REQUIREMENT #6: Additional Storage Add-on boosts storage entitlement by +50 GB per active add-on
    const extraStorageGb = (addons || []).reduce((acc, a) => acc + (a.additionalStorageGb || (a.id === 'addon-storage' ? 50 : 0)), 0);
    const baseStorage = isSubscriptionActive && plan ? plan.maxStorage : 0;
    const effectiveMaxStorage = baseStorage + extraStorageGb;

    const limits = {
      maxUsers: effectiveMaxUsers,
      maxDepartments: effectiveMaxDepts,
      maxSubmissions: isSubscriptionActive && plan ? (plan.maxSubmissions || 500) : 0,
      maxReports: isSubscriptionActive && plan ? plan.maxReports : 0,
      maxStorage: effectiveMaxStorage,
    };

    return {
      organizationId,
      organizationName: org.name,
      subscription,
      plan: isSubscriptionActive ? plan : null,
      addons,
      usage: {
        users: { 
          current: currentUsers, 
          included: includedUsers,
          additional: additionalUsers,
          chargeableAdditional: chargeableAdditionalUsers,
          maxAdditional: maxAddUsers,
          effectiveMax: effectiveMaxUsers,
          additionalUnitPrice: userUnitPriceMonthly,
          additionalRevenue: Math.round(additionalUserRevenue),
          hasExpansion: hasUserExpansion,
          max: effectiveMaxUsers, 
          percentage: effectiveMaxUsers > 0 ? Math.min(100, Math.round((currentUsers / effectiveMaxUsers) * 100)) : 100 
        },
        departments: { 
          current: currentDepartments, 
          included: includedDepts,
          additional: additionalDepts,
          chargeableAdditional: chargeableAdditionalDepts,
          maxAdditional: maxAddDepts,
          effectiveMax: effectiveMaxDepts,
          additionalUnitPrice: deptUnitPriceMonthly,
          additionalRevenue: Math.round(additionalDeptRevenue),
          hasExpansion: hasDeptExpansion,
          max: effectiveMaxDepts, 
          percentage: effectiveMaxDepts > 0 ? Math.min(100, Math.round((currentDepartments / effectiveMaxDepts) * 100)) : 100 
        },
        submissions: { current: currentMonthSubmissions, max: limits.maxSubmissions, percentage: limits.maxSubmissions > 0 ? Math.min(100, Math.round((currentMonthSubmissions / limits.maxSubmissions) * 100)) : 100 },
        reports: { current: currentReports, max: limits.maxReports, percentage: limits.maxReports > 0 ? Math.min(100, Math.round((currentReports / limits.maxReports) * 100)) : 100 },
        storage: { current: currentStorage, max: limits.maxStorage, percentage: limits.maxStorage > 0 ? Math.min(100, Math.round((currentStorage / limits.maxStorage) * 100)) : 100 },
      },
    };
  }

  // ----------------------------------------------------
  // 6. BACKEND LIMIT ENFORCEMENT HELPERS
  // ----------------------------------------------------
  checkLimit(organizationId: string, resourceType: 'users' | 'departments' | 'submissions' | 'reports'): void {
    if (!organizationId) return; // Skip if no org context (e.g. system setup)
    let usageData = this.getOrganizationUsage(organizationId);

    if (!usageData.subscription || (usageData.subscription.status !== 'ACTIVE' && usageData.subscription.status !== 'TRIAL')) {
      try {
        this.store.create<Subscription>('subscriptions', {
          id: `sub-${organizationId}`,
          organizationId,
          planId: 'plan-pro',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          addonIds: [],
          startDate: new Date().toISOString().slice(0, 10),
          renewalDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Subscription, 'sub');
        usageData = this.getOrganizationUsage(organizationId);
      } catch (_) {}
    }

    if (resourceType === 'users') {
      const current = usageData.usage.users.current;
      const effectiveMax = usageData.usage.users.effectiveMax;
      if (effectiveMax > 0 && current >= effectiveMax) {
        throw new BadRequestException(
          `Additional user capacity limit reached for your ${usageData.plan?.name || 'Commercial'} plan. You currently have ${current}/${effectiveMax} supported users. Please upgrade to a higher plan.`
        );
      }
    } else if (resourceType === 'departments') {
      const current = usageData.usage.departments.current;
      const effectiveMax = usageData.usage.departments.effectiveMax;
      if (effectiveMax > 0 && current >= effectiveMax) {
        throw new BadRequestException(
          `Additional department capacity limit reached for your ${usageData.plan?.name || 'Commercial'} plan. You currently have ${current}/${effectiveMax} supported departments. Please upgrade to a higher plan.`
        );
      }
    } else if (resourceType === 'submissions' || resourceType === 'reports') {
      const item = usageData.usage[resourceType];
      if (item && item.current >= item.max) {
        const resourceLabels: Record<string, string> = {
          submissions: 'Monthly submissions',
          reports: 'Compliance reports',
        };
        const label = resourceLabels[resourceType] || resourceType;
        throw new BadRequestException(
          `${label} limit reached for your current ${usageData.plan?.name || 'Commercial'} plan (${item.current}/${item.max}). Please upgrade your commercial subscription to add more ${resourceType}.`
        );
      }
    }
  }

  checkStorageLimit(organizationId: string, incomingSizeBytes: number = 0): void {
    if (!organizationId) return;
    const usageData = this.getOrganizationUsage(organizationId);

    if (!usageData.subscription || (usageData.subscription.status !== 'ACTIVE' && usageData.subscription.status !== 'TRIAL')) {
      throw new BadRequestException(
        `No active commercial subscription found for organization ${usageData.organizationName}. Please subscribe to a commercial plan to perform this action.`
      );
    }

    const currentGb = usageData.usage.storage.current;
    const maxGb = usageData.usage.storage.max;
    const incomingGb = Number((incomingSizeBytes / (1024 * 1024 * 1024)).toFixed(4));

    if (maxGb > 0 && currentGb + incomingGb > maxGb) {
      throw new BadRequestException(
        `Storage limit reached for your ${usageData.plan?.name || 'Commercial'} plan (${currentGb} GB / ${maxGb} GB). Upgrade your plan or purchase Additional Storage.`
      );
    }
  }
}
