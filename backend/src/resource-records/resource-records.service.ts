import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { isAfter, isBefore } from 'date-fns';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { ResourcesService } from '../resources/resources.service';
import { CalculationsService } from '../calculations/calculations.service';
import { CreateResourceRecordDto, ReviewDecisionDto, UpdateResourceRecordDto } from './dto/resource-record.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { SubmissionStatus } from '../database/types';

const EDITABLE_STATUSES: SubmissionStatus[] = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

@Injectable()
export class ResourceRecordsService {
  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly resourcesService: ResourcesService,
    private readonly calculations: CalculationsService,
    private readonly views: ViewsService,
  ) {}

  // ---------------------------------------------------------------------
  // Contributor: create draft
  // ---------------------------------------------------------------------
  create(user: AuthenticatedOrgUser, dto: CreateResourceRecordDto) {
    if (!user.departmentId) {
      throw new BadRequestException('Your account is not assigned to a department yet — contact your Org Admin.');
    }
    if (isBefore(new Date(dto.periodEnd), new Date(dto.periodStart))) {
      throw new BadRequestException('Period end date cannot be before the start date.');
    }
    if (isAfter(new Date(dto.periodStart), new Date())) {
      throw new BadRequestException('Cannot log usage for a future period.');
    }

    if (!this.resourcesService.isUnitCompatible(dto.resourceTypeId, dto.unit)) {
      throw new BadRequestException(`"${dto.unit}" is not a valid unit for this resource type.`);
    }

    if (dto.locationId) {
      const location = this.db.store.locations.find((l) => l.id === dto.locationId);
      if (!location || location.departmentId !== user.departmentId) {
        throw new BadRequestException('That location does not belong to your department.');
      }
    }

    const resourceType = this.resourcesService.findOneType(dto.resourceTypeId);
    const evidenceRequirement =
      resourceType.evidenceThreshold !== null && dto.quantity > resourceType.evidenceThreshold
        ? 'REQUIRED'
        : 'NOT_REQUIRED';

    const now = this.db.now();
    const record = {
      id: this.db.id(),
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      locationId: dto.locationId ?? null,
      resourceTypeId: dto.resourceTypeId,
      quantity: dto.quantity,
      unit: dto.unit,
      cost: dto.cost ?? null,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      notes: dto.notes ?? null,
      status: 'DRAFT' as SubmissionStatus,
      evidenceRequirement: evidenceRequirement as 'REQUIRED' | 'NOT_REQUIRED',
      createdById: user.sub,
      submittedAt: null,
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.resourceRecords.push(record);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'resource_record.created',
      entityType: 'resource_record',
      entityId: record.id,
    });

    // Basic threshold-crossing anomaly signal.
    if (resourceType.evidenceThreshold !== null && dto.quantity > resourceType.evidenceThreshold * 3) {
      this.db.store.alerts.push({
        id: this.db.id(),
        organizationId: user.organizationId,
        severity: 'CRITICAL',
        status: 'OPEN',
        type: 'usage_anomaly',
        message: `Unusually high usage logged: ${dto.quantity} ${dto.unit} — more than 3x the evidence threshold.`,
        relatedResourceRecordId: record.id,
        relatedDepartmentId: user.departmentId,
        createdAt: now,
      });
      this.db.persist();
    }

    return record;
  }

  // ---------------------------------------------------------------------
  // Contributor: edit — only while Draft / Rejected / Changes Requested
  // ---------------------------------------------------------------------
  update(user: AuthenticatedOrgUser, id: string, dto: UpdateResourceRecordDto) {
    const record = this.findOwned(user, id);

    if (!EDITABLE_STATUSES.includes(record.status)) {
      throw new ForbiddenException(
        'This entry is locked and can no longer be edited. Once approved, corrections require a formal amendment.',
      );
    }

    if (dto.unit && dto.unit !== record.unit && !this.resourcesService.isUnitCompatible(record.resourceTypeId, dto.unit)) {
      throw new BadRequestException(`"${dto.unit}" is not a valid unit for this resource type.`);
    }

    if (dto.quantity !== undefined) record.quantity = dto.quantity;
    if (dto.unit !== undefined) record.unit = dto.unit;
    if (dto.cost !== undefined) record.cost = dto.cost;
    if (dto.notes !== undefined) record.notes = dto.notes;
    record.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'resource_record.edited',
      entityType: 'resource_record',
      entityId: id,
    });

    return record;
  }

  // ---------------------------------------------------------------------
  // Contributor: submit for review (first time or resubmission)
  // ---------------------------------------------------------------------
  submit(user: AuthenticatedOrgUser, id: string) {
    const record = this.findOwned(user, id);

    if (!EDITABLE_STATUSES.includes(record.status)) {
      throw new ForbiddenException('This entry has already been submitted or is locked.');
    }

    if (record.evidenceRequirement === 'REQUIRED') {
      const hasEvidence = this.db.store.evidence.some((e) => e.resourceRecordId === id);
      if (!hasEvidence) {
        throw new BadRequestException(
          `Evidence is required before submitting: this entry exceeds the threshold for ${record.unit}. Please attach supporting documentation.`,
        );
      }
    }

    const isResubmission = record.status === 'REJECTED' || record.status === 'CHANGES_REQUESTED';
    record.status = 'SUBMITTED';
    record.submittedAt = this.db.now();
    record.updatedAt = this.db.now();

    if (isResubmission) {
      const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id)!;
      submission.status = 'SUBMITTED';
      submission.version += 1;
      submission.reviewedById = null;
      submission.reviewComment = null;
      submission.reviewedAt = null;
      submission.updatedAt = this.db.now();
    } else {
      this.db.store.submissions.push({
        id: this.db.id(),
        resourceRecordId: id,
        organizationId: user.organizationId,
        departmentId: record.departmentId,
        status: 'SUBMITTED',
        reviewedById: null,
        reviewComment: null,
        reviewedAt: null,
        version: 1,
        createdAt: this.db.now(),
        updatedAt: this.db.now(),
      });
    }
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: isResubmission ? 'submission.resubmitted' : 'submission.created',
      entityType: 'resource_record',
      entityId: id,
    });

    return record;
  }

  // ---------------------------------------------------------------------
  // Reviewer: approve / reject / request changes
  // ---------------------------------------------------------------------
  approve(reviewer: AuthenticatedOrgUser, id: string, dto: ReviewDecisionDto) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted entries can be reviewed.');
    }

    record.status = 'APPROVED';
    record.updatedAt = this.db.now();

    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id)!;
    submission.status = 'APPROVED';
    submission.reviewedById = reviewer.sub;
    submission.reviewComment = dto.comment ?? null;
    submission.reviewedAt = this.db.now();
    submission.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'submission.approved',
      entityType: 'resource_record',
      entityId: id,
      metadata: { comment: dto.comment },
    });

    // Auto-calculate on approval, then lock.
    this.calculations.calculateForRecord(id);

    record.status = 'LOCKED';
    record.lockedAt = this.db.now();
    record.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'resource_record.locked',
      entityType: 'resource_record',
      entityId: id,
    });

    return record;
  }

  reject(reviewer: AuthenticatedOrgUser, id: string, dto: ReviewDecisionDto) {
    return this.decide(reviewer, id, 'REJECTED', dto);
  }

  requestChanges(reviewer: AuthenticatedOrgUser, id: string, dto: ReviewDecisionDto) {
    return this.decide(reviewer, id, 'CHANGES_REQUESTED', dto);
  }

  /** Manual recalculation — e.g. after a factor correction that doesn't
   * itself change the record (so no amendment needed), but should still
   * be reflected in the emissions/financial output. */
  recalculate(reviewer: AuthenticatedOrgUser, id: string) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'LOCKED') {
      throw new BadRequestException('Only locked entries have a calculation to recalculate.');
    }

    const result = this.calculations.recalculate(id);

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'calculation.recalculated',
      entityType: 'resource_record',
      entityId: id,
    });

    return result;
  }

  private decide(
    reviewer: AuthenticatedOrgUser,
    id: string,
    status: 'REJECTED' | 'CHANGES_REQUESTED',
    dto: ReviewDecisionDto,
  ) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted entries can be reviewed.');
    }

    record.status = status;
    record.updatedAt = this.db.now();

    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id)!;
    submission.status = status;
    submission.reviewedById = reviewer.sub;
    submission.reviewComment = dto.comment ?? null;
    submission.reviewedAt = this.db.now();
    submission.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: status === 'REJECTED' ? 'submission.rejected' : 'submission.changes_requested',
      entityType: 'resource_record',
      entityId: id,
      metadata: { comment: dto.comment },
    });

    return record;
  }

  // ---------------------------------------------------------------------
  // Reads — role-scoped
  // ---------------------------------------------------------------------
  findAll(user: AuthenticatedOrgUser) {
    let records = this.db.store.resourceRecords.filter((r) => r.organizationId === user.organizationId);
    if (user.role === 'CONTRIBUTOR' && user.departmentId) {
      records = records.filter((r) => r.departmentId === user.departmentId);
    }
    return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => this.views.record(r));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    return this.views.record(this.getInOrg(user, id));
  }

  private getInOrg(user: AuthenticatedOrgUser, id: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === id && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    if (user.role === 'CONTRIBUTOR' && user.departmentId && record.departmentId !== user.departmentId) {
      throw new NotFoundException('Resource record not found.');
    }
    return record;
  }

  private findOwned(user: AuthenticatedOrgUser, id: string) {
    const record = this.getInOrg(user, id);
    if (user.role === 'CONTRIBUTOR' && record.createdById !== user.sub) {
      throw new ForbiddenException('You can only edit your own entries.');
    }
    return record;
  }
}
