import { ForbiddenException } from '@nestjs/common';
import { DbService } from '../database/db.service';

/**
 * 0 or >= 999 denotes unlimited for any quota.
 */
export const isUnlimited = (val: number | null | undefined): boolean =>
  val === 0 || (val !== null && val !== undefined && val >= 999);

/**
 * Ensures the organization's subscription is operational (active or unexpired trial).
 * Automatically transitions expired trials to EXPIRED.
 */
export function assertSubscriptionOperational(db: DbService, organizationId: string) {
  const sub = db.store.subscriptions.find((s) => s.organizationId === organizationId);
  if (!sub) return;

  if (sub.status === 'TRIAL' && sub.renewalDate && new Date(sub.renewalDate) < new Date()) {
    sub.status = 'EXPIRED';
    sub.updatedAt = db.now();
    db.persist();
  }

  if (['EXPIRED', 'CANCELLED', 'PAST_DUE'].includes(sub.status)) {
    const readable = sub.status.toLowerCase().replace('_', ' ');
    throw new ForbiddenException(
      `Your organization's subscription is ${readable}. Please update your billing to continue.`,
    );
  }
}

/**
 * maxResourceTypes caps how many DIFFERENT resource types an organization may
 * record data against (resource types themselves are global, defined by the
 * platform). A type the organization already uses is always allowed.
 */
export function assertResourceTypeWithinPlan(db: DbService, organizationId: string, resourceTypeIds: string | string[]) {
  assertSubscriptionOperational(db, organizationId);
  const subscription = db.store.subscriptions.find((s) => s.organizationId === organizationId);
  const plan = subscription && db.store.plans.find((p) => p.id === subscription.planId);
  if (!plan || isUnlimited(plan.maxResourceTypes)) return;

  const used = new Set(db.store.resourceRecords.filter((r) => r.organizationId === organizationId).map((r) => r.resourceTypeId));
  for (const id of Array.isArray(resourceTypeIds) ? resourceTypeIds : [resourceTypeIds]) used.add(id);
  if (used.size > plan.maxResourceTypes) {
    throw new ForbiddenException(
      `Your ${plan.name} plan allows up to ${plan.maxResourceTypes} different resource types. Upgrade your plan to track more.`,
    );
  }
}

export function assertWithinPlan(db: DbService, organizationId: string, resource: 'users' | 'departments') {
  assertSubscriptionOperational(db, organizationId);
  const subscription = db.store.subscriptions.find((s) => s.organizationId === organizationId);
  const plan = subscription && db.store.plans.find((p) => p.id === subscription.planId);
  if (!plan) return; // no plan on record: nothing to enforce

  const limit = resource === 'users' ? plan.maxUsers : plan.maxDepartments;
  if (isUnlimited(limit)) return;

  const used =
    resource === 'users'
      ? db.store.orgUsers.filter((u) => u.organizationId === organizationId && u.isActive && !u.deletedAt).length
      : db.store.departments.filter((d) => d.organizationId === organizationId && !d.deletedAt).length;

  if (used >= limit) {
    throw new ForbiddenException(
      `Your ${plan.name} plan allows up to ${limit} ${resource}. Upgrade your plan to add more.`,
    );
  }
}
