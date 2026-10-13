import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { CalculationsService } from '../calculations/calculations.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { DecideAmendmentDto, ProposeAmendmentDto } from './dto/amendment.dto';

/** Materiality threshold from the GHG Protocol baseline-recalculation rule:
 * a change of more than this percentage of the original value flags the
 * org's baseline (and any reports built on it) as needing review. */
const MATERIALITY_THRESHOLD_PERCENT = 5;

@Injectable()
export class AmendmentsService {
  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly calculations: CalculationsService,
    private readonly views: ViewsService,
  ) {}

  // ---------------------------------------------------------------------
  // Reviewer proposes a correction to a LOCKED record
  // ---------------------------------------------------------------------
  propose(reviewer: AuthenticatedOrgUser, resourceRecordId: string, dto: ProposeAmendmentDto) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === reviewer.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    if (record.status !== 'LOCKED') {
      throw new BadRequestException('Only locked/approved entries need a formal amendment.');
    }
    if (dto.proposedQuantity === undefined && dto.proposedCost === undefined) {
      throw new BadRequestException('Provide at least a proposedQuantity or proposedCost to amend.');
    }

    const originalQuantity = record.quantity;
    const newQuantity = dto.proposedQuantity ?? originalQuantity;
    const materialityPercent =
      originalQuantity > 0 ? (Math.abs(newQuantity - originalQuantity) / originalQuantity) * 100 : 0;
    const triggersBaselineRecalc = materialityPercent > MATERIALITY_THRESHOLD_PERCENT;

    const amendment = {
      id: this.db.id(),
      resourceRecordId,
      status: 'PENDING_APPROVAL' as const,
      reason: dto.reason,
      proposedQuantity: dto.proposedQuantity ?? null,
      proposedCost: dto.proposedCost ?? null,
      materialityPercent,
      triggersBaselineRecalc,
      proposedById: reviewer.sub,
      approvedById: null,
      approvalComment: null,
      createdAt: this.db.now(),
      resolvedAt: null,
    };
    this.db.store.amendments.push(amendment);
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'amendment.proposed',
      entityType: 'amendment',
      entityId: amendment.id,
      metadata: { resourceRecordId, materialityPercent, triggersBaselineRecalc },
    });

    return amendment;
  }

  // ---------------------------------------------------------------------
  // Executive approves or rejects — leadership sign-off on a restatement
  // of official data, per the revised role split (was Org Admin).
  // ---------------------------------------------------------------------
  approve(executive: AuthenticatedOrgUser, amendmentId: string, dto: DecideAmendmentDto) {
    const amendment = this.getPending(executive, amendmentId);
    const record = this.db.store.resourceRecords.find((r) => r.id === amendment.resourceRecordId)!;

    if (amendment.proposedQuantity !== null) record.quantity = amendment.proposedQuantity;
    if (amendment.proposedCost !== null) record.cost = amendment.proposedCost;
    record.updatedAt = this.db.now();

    amendment.status = 'APPROVED';
    amendment.approvedById = executive.sub;
    amendment.approvalComment = dto.comment ?? null;
    amendment.resolvedAt = this.db.now();
    this.db.persist();

    // Recalculate against the corrected figures — stays LOCKED, only the
    // calculation output changes.
    this.calculations.recalculate(record.id);

    if (amendment.triggersBaselineRecalc) {
      // Flag dependent approved reports covering this period as needing
      // re-review, since a >5% material change occurred within them.
      this.db.store.reports
        .filter(
          (r) =>
            r.organizationId === executive.organizationId &&
            r.status === 'APPROVED' &&
            r.periodStart <= record.periodStart &&
            r.periodEnd >= record.periodEnd,
        )
        .forEach((r) => (r.status = 'REVISION_REQUESTED'));
      this.db.persist();
    }

    this.auditLog.log({
      organizationId: executive.organizationId,
      orgUserId: executive.sub,
      action: 'amendment.approved',
      entityType: 'amendment',
      entityId: amendmentId,
      metadata: { triggeredBaselineRecalc: amendment.triggersBaselineRecalc },
    });

    return amendment;
  }

  reject(executive: AuthenticatedOrgUser, amendmentId: string, dto: DecideAmendmentDto) {
    const amendment = this.getPending(executive, amendmentId);
    amendment.status = 'REJECTED';
    amendment.approvedById = executive.sub;
    amendment.approvalComment = dto.comment ?? null;
    amendment.resolvedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: executive.organizationId,
      orgUserId: executive.sub,
      action: 'amendment.rejected',
      entityType: 'amendment',
      entityId: amendmentId,
    });

    return amendment;
  }

  /** Amendment history for one record — scoped to the caller's own org. */
  findAllForRecord(user: AuthenticatedOrgUser, resourceRecordId: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    return this.db.store.amendments
      .filter((a) => a.resourceRecordId === resourceRecordId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => this.views.amendment(a));
  }

  /** Every amendment in the caller's organization, newest first. */
  findAll(user: AuthenticatedOrgUser) {
    const orgRecordIds = new Set(
      this.db.store.resourceRecords.filter((r) => r.organizationId === user.organizationId).map((r) => r.id),
    );
    return this.db.store.amendments
      .filter((a) => orgRecordIds.has(a.resourceRecordId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => this.views.amendment(a));
  }

  private getPending(executive: AuthenticatedOrgUser, amendmentId: string) {
    const amendment = this.db.store.amendments.find((a) => a.id === amendmentId);
    if (!amendment) throw new NotFoundException('Amendment not found.');

    const record = this.db.store.resourceRecords.find((r) => r.id === amendment.resourceRecordId);
    if (!record || record.organizationId !== executive.organizationId) {
      throw new NotFoundException('Amendment not found.');
    }
    if (amendment.status !== 'PENDING_APPROVAL') {
      throw new ForbiddenException('This amendment has already been resolved.');
    }
    return amendment;
  }
}
