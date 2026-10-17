import { assertResourceTypeWithinPlan, assertSubscriptionOperational } from '../billing/plan-limits';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { differenceInDays, isAfter, isBefore } from 'date-fns';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { ResourcesService } from '../resources/resources.service';
import { CalculationsService } from '../calculations/calculations.service';
import { resolveFactors } from '../calculations/factor-resolution';
import {
  CreateResourceRecordDto,
  IngestTelemetryDto,
  ReviewDecisionDto,
  UpdateResourceRecordDto,
  WithdrawResourceRecordDto,
} from './dto/resource-record.dto';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ResourceRecord, Submission, SubmissionStatus } from '../database/types';
import { EvidenceService } from '../evidence/evidence.service';

const CLAIM_TTL_MS = 15 * 60 * 1000; // 15-minute soft review lease
const EDITABLE_STATUSES: SubmissionStatus[] = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

@Injectable()
export class ResourceRecordsService {
  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly resourcesService: ResourcesService,
    private readonly calculations: CalculationsService,
    private readonly views: ViewsService,
    private readonly evidenceService: EvidenceService,
  ) {}

  private assertNoOverlappingInterval(
    organizationId: string,
    departmentId: string,
    locationId: string | null | undefined,
    resourceTypeId: string,
    periodStart: string,
    periodEnd: string,
    excludeRecordId?: string,
  ) {
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    const normalizedLoc = locationId || null;

    const collision = this.db.store.resourceRecords.find((r) => {
      if (r.id === excludeRecordId) return false;
      if (r.organizationId !== organizationId) return false;
      if (r.departmentId !== departmentId) return false;
      if (r.resourceTypeId !== resourceTypeId) return false;
      if ((r.locationId || null) !== normalizedLoc) return false;
      if (r.status === 'REJECTED' || r.withdrawnAt) return false;

      const exStart = new Date(r.periodStart).getTime();
      const exEnd = new Date(r.periodEnd).getTime();

      return (start < exEnd && end > exStart) || (start === exStart && end === exEnd);
    });

    if (collision) {
      throw new ConflictException(
        `Meter interval overlap detected: An active record (${collision.periodStart} to ${collision.periodEnd}, status: ${collision.status}) already accounts for this resource. Overlapping intervals violate GHG Protocol double-counting assurance controls.`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Contributor: create draft
  // ---------------------------------------------------------------------
  create(user: AuthenticatedOrgUser, dto: CreateResourceRecordDto) {
    assertSubscriptionOperational(this.db, user.organizationId);

    if (!user.departmentId) {
      throw new BadRequestException('Your account is not assigned to a department yet — contact your Org Admin.');
    }

    const dept = this.db.store.departments.find(
      (d) => d.id === user.departmentId && d.organizationId === user.organizationId,
    );
    if (!dept) {
      throw new BadRequestException('Assigned department not found.');
    }

    // Operational boundary scope: verify department resource type entitlement
    if (dept.allowedResourceTypeIds && dept.allowedResourceTypeIds.length > 0) {
      if (!dept.allowedResourceTypeIds.includes(dto.resourceTypeId)) {
        const resType = this.db.store.resourceTypes.find((t) => t.id === dto.resourceTypeId);
        const resourceName = resType?.name ?? 'this resource type';
        throw new BadRequestException(
          `Your department (${dept.name}) is not authorized to submit ${resourceName}. It is outside your operational boundary mandate.`,
        );
      }
    }

    if (isBefore(new Date(dto.periodEnd), new Date(dto.periodStart))) {
      throw new BadRequestException('Period end date cannot be before the start date.');
    }
    if (isAfter(new Date(dto.periodStart), new Date())) {
      throw new BadRequestException('Cannot log usage for a future period.');
    }

    // Maximum interval duration: 366 days
    const durationDays = differenceInDays(new Date(dto.periodEnd), new Date(dto.periodStart));
    if (durationDays > 366) {
      throw new BadRequestException(
        'Activity period duration cannot exceed 366 days (1 year). Under GHG Protocol corporate accounting rules, activity data must be reported with at least annual temporal granularity.',
      );
    }

    // Closed reporting period lockbox: prevent direct intake into periods covered by an approved report
    const isClosedByReport = this.db.store.reports.some(
      (r) =>
        r.organizationId === user.organizationId &&
        r.status === 'APPROVED' &&
        !(new Date(dto.periodEnd) < new Date(r.periodStart) || new Date(dto.periodStart) > new Date(r.periodEnd)),
    );
    if (isClosedByReport) {
      throw new ForbiddenException(
        'This reporting period falls within an Executive-approved and published Sustainability Report. Direct operational submission into closed periods is prohibited to preserve audit integrity. Use the Historical Amendment workflow to propose an official restatement.',
      );
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

    assertResourceTypeWithinPlan(this.db, user.organizationId, dto.resourceTypeId);

    this.assertNoOverlappingInterval(
      user.organizationId,
      user.departmentId,
      dto.locationId,
      dto.resourceTypeId,
      dto.periodStart,
      dto.periodEnd,
    );

    const now = this.db.now();
    const record: ResourceRecord = {
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
      evidenceRequirement: 'NOT_REQUIRED' as 'REQUIRED' | 'NOT_REQUIRED',
      createdById: user.sub,
      submittedAt: null,
      lockedAt: null,
      marketInstrument: dto.marketInstrument ?? null,
      deviceId: dto.deviceId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.syncEvidenceAndAlerts(record);

    this.db.store.resourceRecords.push(record);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'resource_record.created',
      entityType: 'resource_record',
      entityId: record.id,
    });

    return record;
  }

  // ---------------------------------------------------------------------
  // Contributor: edit — while Draft / Rejected / Changes Requested
  // ---------------------------------------------------------------------
  update(user: AuthenticatedOrgUser, id: string, dto: UpdateResourceRecordDto) {
    assertSubscriptionOperational(this.db, user.organizationId);
    const record = this.findOwned(user, id);

    if (!EDITABLE_STATUSES.includes(record.status)) {
      throw new ForbiddenException(
        'This entry is locked and can no longer be edited. Once approved, corrections require a formal amendment.',
      );
    }

    if (dto.resourceTypeId && dto.resourceTypeId !== record.resourceTypeId) {
      assertResourceTypeWithinPlan(this.db, user.organizationId, dto.resourceTypeId);
      this.resourcesService.findOneType(dto.resourceTypeId);
      record.resourceTypeId = dto.resourceTypeId;
    }

    const nextUnit = dto.unit ?? record.unit;
    if (!this.resourcesService.isUnitCompatible(record.resourceTypeId, nextUnit)) {
      throw new BadRequestException(`"${nextUnit}" is not a valid unit for this resource type.`);
    }
    record.unit = nextUnit;

    const nextStart = dto.periodStart ?? record.periodStart;
    const nextEnd = dto.periodEnd ?? record.periodEnd;
    if (isBefore(new Date(nextEnd), new Date(nextStart))) {
      throw new BadRequestException('Period end date cannot be before the start date.');
    }
    if (isAfter(new Date(nextStart), new Date())) {
      throw new BadRequestException('Cannot log usage for a future period.');
    }

    if (dto.locationId !== undefined) {
      if (dto.locationId) {
        const location = this.db.store.locations.find((l) => l.id === dto.locationId);
        if (!location || location.departmentId !== user.departmentId) {
          throw new BadRequestException('That location does not belong to your department.');
        }
      }
      record.locationId = dto.locationId ?? null;
    }

    this.assertNoOverlappingInterval(
      user.organizationId,
      record.departmentId,
      record.locationId,
      record.resourceTypeId,
      nextStart,
      nextEnd,
      record.id,
    );

    record.periodStart = nextStart;
    record.periodEnd = nextEnd;

    if (dto.quantity !== undefined) record.quantity = dto.quantity;
    if (dto.cost !== undefined) record.cost = dto.cost;
    if (dto.notes !== undefined) record.notes = dto.notes;
    if (dto.marketInstrument !== undefined) record.marketInstrument = dto.marketInstrument ?? null;
    if (dto.deviceId !== undefined) record.deviceId = dto.deviceId ?? null;

    this.syncEvidenceAndAlerts(record);

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
  // Automated Telemetry / Smart Meter / IoT Ingestion
  // ---------------------------------------------------------------------
  ingestTelemetry(user: AuthenticatedOrgUser, dto: IngestTelemetryDto) {
    assertSubscriptionOperational(this.db, user.organizationId);

    let departmentId = dto.departmentId || user.departmentId;
    if (dto.locationId) {
      const location = this.db.store.locations.find((l) => l.id === dto.locationId);
      if (!location) {
        throw new NotFoundException('Location not found.');
      }
      departmentId = location.departmentId;
    }

    if (!departmentId) {
      const firstDept = this.db.store.departments.find((d) => d.organizationId === user.organizationId && !d.deletedAt);
      if (!firstDept) {
        throw new BadRequestException('Organization has no active departments to assign telemetry to.');
      }
      departmentId = firstDept.id;
    }

    const dept = this.db.store.departments.find((d) => d.id === departmentId && d.organizationId === user.organizationId);
    if (!dept) {
      throw new BadRequestException('Department does not belong to your organization.');
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

    assertResourceTypeWithinPlan(this.db, user.organizationId, dto.resourceTypeId);

    this.assertNoOverlappingInterval(
      user.organizationId,
      departmentId,
      dto.locationId,
      dto.resourceTypeId,
      dto.periodStart,
      dto.periodEnd,
    );

    const now = this.db.now();
    const autoSubmit = dto.autoSubmit !== false;

    const record: ResourceRecord = {
      id: this.db.id(),
      organizationId: user.organizationId,
      departmentId,
      locationId: dto.locationId ?? null,
      resourceTypeId: dto.resourceTypeId,
      quantity: dto.quantity,
      unit: dto.unit,
      cost: dto.cost ?? null,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      notes: dto.notes ?? `Automated meter telemetry [${dto.deviceId}]`,
      status: (autoSubmit ? 'SUBMITTED' : 'DRAFT') as SubmissionStatus,
      evidenceRequirement: 'NOT_REQUIRED',
      createdById: user.sub,
      submittedAt: autoSubmit ? now : null,
      lockedAt: null,
      marketInstrument: dto.marketInstrument ?? null,
      deviceId: dto.deviceId,
      createdAt: now,
      updatedAt: now,
    };

    this.syncEvidenceAndAlerts(record);
    this.db.store.resourceRecords.push(record);

    let submission: Submission | null = null;
    if (autoSubmit) {
      submission = {
        id: this.db.id(),
        resourceRecordId: record.id,
        organizationId: user.organizationId,
        departmentId,
        status: 'SUBMITTED',
        reviewedById: null,
        reviewComment: null,
        reviewedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      this.db.store.submissions.push(submission);

      const factors = resolveFactors(this.db.store, record);
      if (factors.rows.length > 0) {
        this.calculations.calculateForRecord(record.id);
      }
    }

    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'resource_record.telemetry_ingested',
      entityType: 'resource_record',
      entityId: record.id,
      metadata: { deviceId: dto.deviceId, autoSubmit, quantity: dto.quantity, unit: dto.unit },
    });

    return { record, submission };
  }

  // ---------------------------------------------------------------------
  // Contributor: delete draft/rejected/changes_requested entry
  // ---------------------------------------------------------------------
  deleteDraft(user: AuthenticatedOrgUser, id: string) {
    const record = this.findOwned(user, id);
    if (record.status !== 'DRAFT') {
      throw new BadRequestException('Only drafts that have never been submitted can be deleted. Withdraw a submitted entry instead.');
    }

    // Delete managed files before changing metadata so an I/O failure cannot
    // report a successful record deletion while leaving an orphan behind.
    this.evidenceService.deleteFilesForRecord(id);

    // Remove evidence metadata after its corresponding files are handled.
    this.db.store.evidence = this.db.store.evidence.filter((e) => e.resourceRecordId !== id);

    // Detach and annotate any related alerts rather than deleting them
    for (const a of this.db.store.alerts) {
      if (a.relatedResourceRecordId === id) {
        a.relatedResourceRecordId = null;
        a.message = `${a.message} [Entry deleted]`;
      }
    }

    // Remove any comments on this record
    this.db.store.comments = this.db.store.comments.filter(
      (c) => !(c.entityType === 'resource_record' && c.entityId === id),
    );

    // Remove any submissions for this record
    this.db.store.submissions = this.db.store.submissions.filter((s) => s.resourceRecordId !== id);

    // Remove the resource record itself
    this.db.store.resourceRecords = this.db.store.resourceRecords.filter((r) => r.id !== id);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'resource_record.deleted',
      entityType: 'resource_record',
      entityId: id,
    });

    return { id, deleted: true };
  }

  /** Retains the record and all history when its pending submission is withdrawn. */
  withdraw(user: AuthenticatedOrgUser, id: string, dto: WithdrawResourceRecordDto) {
    const record = this.findOwned(user, id);
    if (record.status !== 'SUBMITTED') {
      throw new BadRequestException('Only a pending submitted entry can be withdrawn.');
    }

    const submission = this.db.store.submissions.find((item) => item.resourceRecordId === id);
    if (!submission) throw new NotFoundException('Submission not found.');

    const now = this.db.now();
    record.status = 'WITHDRAWN';
    record.withdrawnAt = now;
    record.withdrawnById = user.sub;
    record.withdrawalReason = dto.reason.trim();
    record.updatedAt = now;
    submission.status = 'WITHDRAWN';
    submission.claimedById = null;
    submission.claimedExpiresAt = null;
    submission.updatedAt = now;
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'submission.withdrawn',
      entityType: 'resource_record',
      entityId: id,
      metadata: { reason: record.withdrawalReason, statusBefore: 'SUBMITTED', statusAfter: 'WITHDRAWN' },
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
  // Reviewer: claim / release / approve / reject / request changes
  // ---------------------------------------------------------------------
  claim(reviewer: AuthenticatedOrgUser, id: string) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'SUBMITTED') {
      this.throwAlreadyDecidedConflict(id, record.status);
    }
    this.assertNotOwnEntry(reviewer, record);

    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id);
    if (!submission) throw new NotFoundException('Submission not found.');

    const isClaimActive = !!(submission.claimedExpiresAt && new Date(submission.claimedExpiresAt) > new Date());
    if (isClaimActive && submission.claimedById && submission.claimedById !== reviewer.sub) {
      const claimer = this.db.store.orgUsers.find((u) => u.id === submission.claimedById);
      const name = claimer?.fullName ?? 'Another reviewer';
      throw new ConflictException(`This submission is currently being reviewed by ${name}.`);
    }

    submission.claimedById = reviewer.sub;
    submission.claimedExpiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();
    submission.updatedAt = this.db.now();
    this.db.persist();

    return this.views.record(record);
  }

  release(reviewer: AuthenticatedOrgUser, id: string) {
    const record = this.getInOrg(reviewer, id);
    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id);
    if (submission && submission.claimedById === reviewer.sub) {
      submission.claimedById = null;
      submission.claimedExpiresAt = null;
      submission.updatedAt = this.db.now();
      this.db.persist();
    }
    return this.views.record(record);
  }

  private throwAlreadyDecidedConflict(id: string, status: string): never {
    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id);
    const reviewerUser = submission?.reviewedById ? this.db.store.orgUsers.find((u) => u.id === submission.reviewedById) : null;
    const reviewerName = reviewerUser?.fullName ?? 'another reviewer';
    const readableStatus = status.toLowerCase().replace(/_/g, ' ');
    throw new ConflictException(`This submission has already been ${readableStatus} by ${reviewerName}.`);
  }

  approve(reviewer: AuthenticatedOrgUser, id: string, dto: ReviewDecisionDto) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'SUBMITTED') {
      this.throwAlreadyDecidedConflict(id, record.status);
    }
    this.assertNotOwnEntry(reviewer, record);

    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id)!;
    const isClaimActive = !!(submission.claimedExpiresAt && new Date(submission.claimedExpiresAt) > new Date());
    if (isClaimActive && submission.claimedById && submission.claimedById !== reviewer.sub) {
      const claimer = this.db.store.orgUsers.find((u) => u.id === submission.claimedById);
      const name = claimer?.fullName ?? 'another reviewer';
      throw new ConflictException(`This submission is currently locked for review by ${name}.`);
    }

    // Must have an applicable emission factor BEFORE approval state change
    const { rows: factorRows } = resolveFactors(this.db.store, record);
    if (factorRows.length === 0) {
      throw new BadRequestException(
        'Cannot approve entry: no applicable emission factor found for this resource type and time period.',
      );
    }

    record.status = 'APPROVED';
    record.updatedAt = this.db.now();

    submission.status = 'APPROVED';
    submission.reviewedById = reviewer.sub;
    submission.reviewComment = dto.comment ?? null;
    submission.reviewedAt = this.db.now();
    submission.claimedById = null;
    submission.claimedExpiresAt = null;
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

  /** Segregation of duties: nobody reviews an entry they created themselves (possible after a role change). */
  private assertNotOwnEntry(reviewer: AuthenticatedOrgUser, record: { createdById: string }) {
    if (record.createdById === reviewer.sub) {
      throw new ForbiddenException('You cannot review an entry you created. Ask another reviewer.');
    }
  }

  private decide(
    reviewer: AuthenticatedOrgUser,
    id: string,
    status: 'REJECTED' | 'CHANGES_REQUESTED',
    dto: ReviewDecisionDto,
  ) {
    const record = this.getInOrg(reviewer, id);
    if (record.status !== 'SUBMITTED') {
      this.throwAlreadyDecidedConflict(id, record.status);
    }
    this.assertNotOwnEntry(reviewer, record);

    const submission = this.db.store.submissions.find((s) => s.resourceRecordId === id)!;
    const isClaimActive = !!(submission.claimedExpiresAt && new Date(submission.claimedExpiresAt) > new Date());
    if (isClaimActive && submission.claimedById && submission.claimedById !== reviewer.sub) {
      const claimer = this.db.store.orgUsers.find((u) => u.id === submission.claimedById);
      const name = claimer?.fullName ?? 'another reviewer';
      throw new ConflictException(`This submission is currently locked for review by ${name}.`);
    }

    record.status = status;
    record.updatedAt = this.db.now();

    submission.status = status;
    submission.reviewedById = reviewer.sub;
    submission.reviewComment = dto.comment ?? null;
    submission.reviewedAt = this.db.now();
    submission.claimedById = null;
    submission.claimedExpiresAt = null;
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
    if (user.role === 'CONTRIBUTOR') {
      if (!user.departmentId) return [];
      records = records.filter((r) => r.departmentId === user.departmentId);
    }
    return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => this.views.record(r));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    return this.views.record(this.getInOrg(user, id));
  }

  /** CSV is the only resource-record export currently in product scope. */
  exportCsv(user: AuthenticatedOrgUser) {
    const rows = this.findAll(user) as Array<Record<string, unknown>>;
    const columns = ['id', 'resourceTypeName', 'departmentName', 'quantity', 'unit', 'cost', 'periodStart', 'periodEnd', 'status', 'notes', 'createdAt'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\r\n');
    this.auditLog.log({ organizationId: user.organizationId, orgUserId: user.sub, action: 'resource_record.exported_csv', entityType: 'resource_record_export', entityId: user.organizationId, metadata: { rows: rows.length } });
    return csv;
  }

  private getInOrg(user: AuthenticatedOrgUser, id: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === id && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    if (user.role === 'CONTRIBUTOR' && (!user.departmentId || record.departmentId !== user.departmentId)) {
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

  private syncEvidenceAndAlerts(record: {
    id: string;
    organizationId: string;
    departmentId: string;
    resourceTypeId: string;
    quantity: number;
    unit: string;
    evidenceRequirement: 'REQUIRED' | 'NOT_REQUIRED';
  }) {
    const resourceType = this.resourcesService.findOneType(record.resourceTypeId);
    record.evidenceRequirement =
      resourceType.evidenceThreshold !== null && record.quantity > resourceType.evidenceThreshold
        ? 'REQUIRED'
        : 'NOT_REQUIRED';

    const existingAlert = this.db.store.alerts.find(
      (a) => a.relatedResourceRecordId === record.id && a.type === 'usage_anomaly' && a.status === 'OPEN',
    );

    if (resourceType.evidenceThreshold !== null && record.quantity > resourceType.evidenceThreshold * 3) {
      const msg = `Unusually high usage logged: ${record.quantity} ${record.unit} — more than 3x the evidence threshold.`;
      if (existingAlert) {
        existingAlert.message = msg;
      } else {
        this.db.store.alerts.push({
          id: this.db.id(),
          organizationId: record.organizationId,
          severity: 'CRITICAL',
          status: 'OPEN',
          type: 'usage_anomaly',
          message: msg,
          relatedResourceRecordId: record.id,
          relatedDepartmentId: record.departmentId,
          createdAt: this.db.now(),
        });
      }
    } else if (existingAlert) {
      existingAlert.status = 'RESOLVED';
      existingAlert.message = `${existingAlert.message} [Resolved: usage within acceptable range]`;
    }
  }
}
