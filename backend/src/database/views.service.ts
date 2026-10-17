import { Injectable } from '@nestjs/common';
import { DbService } from './db.service';
import { Alert, Amendment, Report, ResourceRecord } from './types';
import { resolveFactors } from '../calculations/factor-resolution';
import { convertQuantity } from '../calculations/unit-conversion';

/**
 * Read models: the stored entities joined with the human-readable names and
 * related rows the UI needs (department, resource type, who reviewed it,
 * how the emissions figure was derived). Pure reads — nothing here mutates
 * the store, and every field is derived from data that already exists.
 */
@Injectable()
export class ViewsService {
  constructor(private readonly db: DbService) {}

  private userName(id: string | null | undefined): string | null {
    if (!id) return null;
    return this.db.store.orgUsers.find((u) => u.id === id)?.fullName ?? null;
  }

  record(r: ResourceRecord) {
    const s = this.db.store;
    const type = s.resourceTypes.find((t) => t.id === r.resourceTypeId);
    const dept = s.departments.find((d) => d.id === r.departmentId);
    const loc = r.locationId ? s.locations.find((l) => l.id === r.locationId) : null;
    const submission = s.submissions.find((x) => x.resourceRecordId === r.id) ?? null;
    const calc = s.calculationResults.find((c) => c.resourceRecordId === r.id && !c.supersededAt) ?? null;

    let calculation: Record<string, unknown> | null = null;
    if (calc) {
      const { rows, scope } = resolveFactors(s, r);
      calculation = {
        ...calc,
        factorScope: scope,
        factors: rows.map((f) => ({
          id: f.id,
          gas: f.gas,
          factorValue: f.factorValue,
          gwp: f.gwp,
          unit: f.unit,
          effectiveFrom: f.effectiveFrom,
          isLocked: f.isLocked,
          sourceName: s.emissionFactorSources.find((src) => src.id === f.sourceId)?.name ?? 'Unknown source',
          contributionKg: convertQuantity(r.quantity, r.unit, f.unit) * f.factorValue * f.gwp,
        })),
      };
    }

    return {
      ...r,
      resourceTypeName: type?.name ?? 'Unknown',
      category: type?.category ?? null,
      evidenceThreshold: type?.evidenceThreshold ?? null,
      departmentName: dept?.name ?? 'Unknown',
      locationName: loc?.name ?? null,
      createdByName: this.userName(r.createdById),
      evidenceCount: s.evidence.filter((e) => e.resourceRecordId === r.id).length,
      submission: submission && {
        status: submission.status,
        version: submission.version,
        reviewComment: submission.reviewComment,
        reviewedAt: submission.reviewedAt,
        reviewedByName: this.userName(submission.reviewedById),
        claimedById: submission.claimedById ?? null,
        claimedByName: this.userName(submission.claimedById),
        claimedExpiresAt: submission.claimedExpiresAt ?? null,
        isClaimActive: !!(submission.claimedExpiresAt && new Date(submission.claimedExpiresAt) > new Date()),
      },
      calculation,
    };
  }

  alert(a: Alert) {
    const s = this.db.store;
    const dept = a.relatedDepartmentId ? s.departments.find((d) => d.id === a.relatedDepartmentId) : null;
    const rec = a.relatedResourceRecordId ? s.resourceRecords.find((r) => r.id === a.relatedResourceRecordId) : null;
    const type = rec ? s.resourceTypes.find((t) => t.id === rec.resourceTypeId) : null;
    const calc = rec ? s.calculationResults.find((c) => c.resourceRecordId === rec.id && !c.supersededAt) : null;
    const response = s.alertResponses.find((x) => x.alertId === a.id) ?? null;

    const threshold = type?.evidenceThreshold ?? null;
    return {
      ...a,
      departmentName: dept?.name ?? null,
      record: rec && {
        id: rec.id,
        status: rec.status,
        resourceTypeName: type?.name ?? 'Unknown',
        quantity: rec.quantity,
        unit: rec.unit,
        periodStart: rec.periodStart,
        periodEnd: rec.periodEnd,
        evidenceThreshold: threshold,
        // How far past the type's evidence threshold this entry sits.
        varianceVsThreshold: threshold !== null ? rec.quantity - threshold : null,
        variancePercent: threshold ? ((rec.quantity - threshold) / threshold) * 100 : null,
        co2eKg: calc?.co2eKg ?? null,
      },
      response: response && {
        action: response.action,
        responseText: response.responseText,
        respondedByName: this.userName(response.respondedById),
        createdAt: response.createdAt,
      },
    };
  }

  amendment(a: Amendment) {
    const s = this.db.store;
    const rec = s.resourceRecords.find((r) => r.id === a.resourceRecordId);
    const type = rec ? s.resourceTypes.find((t) => t.id === rec.resourceTypeId) : null;
    const dept = rec ? s.departments.find((d) => d.id === rec.departmentId) : null;
    return {
      ...a,
      proposedByName: this.userName(a.proposedById),
      approvedByName: this.userName(a.approvedById),
      record: rec && {
        id: rec.id,
        resourceTypeName: type?.name ?? 'Unknown',
        departmentName: dept?.name ?? 'Unknown',
        quantity: rec.quantity,
        unit: rec.unit,
        cost: rec.cost,
        periodStart: rec.periodStart,
        periodEnd: rec.periodEnd,
      },
    };
  }

  report(r: Report) {
    const s = this.db.store;
    // Full version chain, oldest first, so the UI can show decision history.
    const chain: Report[] = [];
    let cursor: Report | undefined = r;
    while (cursor) {
      chain.unshift(cursor);
      cursor = cursor.supersedesId ? s.reports.find((x) => x.id === cursor!.supersedesId) : undefined;
    }
    return {
      ...r,
      createdByName: this.userName(r.createdById),
      approvedByName: this.userName(r.approvedById),
      history: chain.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        approvalComment: v.approvalComment,
        approvedByName: this.userName(v.approvedById),
        approvedAt: v.approvedAt,
        updatedAt: v.updatedAt,
      })),
    };
  }
}
