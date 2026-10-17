import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser, AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { ChangePlanDto, CreatePlanDto } from './dto/billing.dto';
import { isUnlimited } from './plan-limits';

@Injectable()
export class BillingService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  // ---------------------------------------------------------------------
  // Plans — Platform Admin manages, everyone can read
  // ---------------------------------------------------------------------
  createPlan(admin: AuthenticatedPlatformAdmin, dto: CreatePlanDto) {
    if (this.db.store.plans.some((p) => p.name.toLowerCase() === dto.name.trim().toLowerCase())) {
      throw new ConflictException('A plan with this name already exists.');
    }

    const plan = {
      id: this.db.id(),
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      maxDepartments: dto.maxDepartments,
      maxUsers: dto.maxUsers,
      maxResourceTypes: dto.maxResourceTypes,
      reportFrequency: dto.reportFrequency,
      priceMonthly: dto.priceMonthly,
      priceAnnual: dto.priceAnnual,
      isActive: true,
    };
    this.db.store.plans.push(plan);
    this.db.persist();

    this.auditLog.log({
      platformAdminId: admin.sub,
      action: 'plan.created',
      entityType: 'plan',
      entityId: plan.id,
    });

    return plan;
  }

  listPlans() {
    return this.db.store.plans.filter((p) => p.isActive).sort((a, b) => a.priceMonthly - b.priceMonthly);
  }

  // ---------------------------------------------------------------------
  // Org-facing: subscription + mock invoices
  // ---------------------------------------------------------------------
  getMySubscription(user: AuthenticatedOrgUser) {
    const sub = this.db.store.subscriptions.find((s) => s.organizationId === user.organizationId);
    if (!sub) throw new NotFoundException('No subscription found for your organization.');

    // If trial has expired, mark it expired
    if (sub.status === 'TRIAL' && sub.renewalDate && new Date(sub.renewalDate) < new Date()) {
      sub.status = 'EXPIRED';
      sub.updatedAt = this.db.now();
      this.db.persist();
    }

    const plan = this.db.store.plans.find((p) => p.id === sub.planId);
    return { ...sub, plan };
  }

  getMyInvoices(user: AuthenticatedOrgUser) {
    return this.db.store.invoices
      .filter((i) => i.organizationId === user.organizationId)
      .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  }

  /** Takes effect immediately in this mocked-billing implementation — no
   * real payment gateway, no waiting on a charge to clear. */
  changePlan(user: AuthenticatedOrgUser, dto: ChangePlanDto) {
    const plan = this.db.store.plans.find((p) => p.id === dto.planId && p.isActive);
    if (!plan) throw new NotFoundException('Plan not found.');

    // Enforce users cap on downgrade
    const userCount = this.db.store.orgUsers.filter(
      (u) => u.organizationId === user.organizationId && u.isActive,
    ).length;
    if (!isUnlimited(plan.maxUsers) && userCount > plan.maxUsers) {
      throw new BadRequestException(
        `This plan allows up to ${plan.maxUsers} users, but your organization currently has ${userCount}.`,
      );
    }

    // Enforce departments cap on downgrade
    const deptCount = this.db.store.departments.filter(
      (d) => d.organizationId === user.organizationId,
    ).length;
    if (!isUnlimited(plan.maxDepartments) && deptCount > plan.maxDepartments) {
      throw new BadRequestException(
        `This plan allows up to ${plan.maxDepartments} departments, but your organization currently has ${deptCount}.`,
      );
    }

    // Enforce resource types cap on downgrade
    const usedTypesCount = new Set(
      this.db.store.resourceRecords
        .filter((r) => r.organizationId === user.organizationId)
        .map((r) => r.resourceTypeId),
    ).size;
    if (!isUnlimited(plan.maxResourceTypes) && usedTypesCount > plan.maxResourceTypes) {
      throw new BadRequestException(
        `This plan allows up to ${plan.maxResourceTypes} resource types, but your organization currently uses ${usedTypesCount}.`,
      );
    }

    const sub = this.db.store.subscriptions.find((s) => s.organizationId === user.organizationId);
    if (!sub) throw new NotFoundException('No subscription found for your organization.');

    sub.planId = plan.id;
    sub.status = 'ACTIVE';
    sub.renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    sub.updatedAt = this.db.now();

    this.db.store.invoices.push({
      id: this.db.id(),
      organizationId: user.organizationId,
      subscriptionId: sub.id,
      amount: plan.priceMonthly,
      currency: 'USD',
      status: 'mock_paid',
      issuedAt: this.db.now(),
      periodStart: this.db.now(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      description: `${plan.name} plan, monthly subscription`,
    });
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'subscription.plan_changed',
      entityType: 'subscription',
      entityId: sub.id,
      metadata: { newPlan: plan.name },
    });

    return sub;
  }
}
