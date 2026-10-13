import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { GenerateReportDto, ReportDecisionDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly views: ViewsService,
  ) {}

  // ---------------------------------------------------------------------
  // Reviewer: generate a draft report from LOCKED data in the period
  // ---------------------------------------------------------------------
  generate(reviewer: AuthenticatedOrgUser, dto: GenerateReportDto) {
    const content = this.buildContent(reviewer.organizationId, dto.periodStart, dto.periodEnd);
    const now = this.db.now();

    const report = {
      id: this.db.id(),
      organizationId: reviewer.organizationId,
      title: dto.title,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      contentJson: content,
      pdfFilePath: null,
      status: 'DRAFT' as const,
      version: 1,
      createdById: reviewer.sub,
      approvedById: null,
      approvalComment: null,
      approvedAt: null,
      supersedesId: null,
      isScheduled: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.reports.push(report);
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'report.generated',
      entityType: 'report',
      entityId: report.id,
    });

    return report;
  }

  /** Aggregates LOCKED resource records + their calculation results into
   * a by-department, by-resource-type, financial-summary breakdown. */
  private buildContent(organizationId: string, periodStart: string, periodEnd: string) {
    const records = this.db.store.resourceRecords.filter(
      (r) =>
        r.organizationId === organizationId &&
        r.status === 'LOCKED' &&
        r.periodStart >= periodStart &&
        r.periodEnd <= periodEnd,
    );

    const byDepartment: Record<string, any> = {};
    const byResourceType: Record<string, any> = {};
    let totalCo2eKg = 0;
    let totalCost = 0;
    let totalSavings = 0;
    let totalExposure = 0;
    let entryCount = 0;

    for (const record of records) {
      const calc = this.db.store.calculationResults.find((c) => c.resourceRecordId === record.id);
      if (!calc) continue;
      entryCount++;

      const dept = this.db.store.departments.find((d) => d.id === record.departmentId);
      const type = this.db.store.resourceTypes.find((t) => t.id === record.resourceTypeId);

      const co2e = calc.co2eKg;
      const cost = calc.costOfUsage ?? 0;
      const savings = calc.savingsVsBaseline ?? 0;
      const exposure = calc.carbonExposure ?? 0;

      totalCo2eKg += co2e;
      totalCost += cost;
      totalSavings += savings;
      totalExposure += exposure;

      const deptName = dept?.name ?? 'Unknown';
      byDepartment[deptName] ??= { co2eKg: 0, cost: 0, entries: 0 };
      byDepartment[deptName].co2eKg += co2e;
      byDepartment[deptName].cost += cost;
      byDepartment[deptName].entries += 1;

      const typeName = type?.name ?? 'Unknown';
      byResourceType[typeName] ??= { co2eKg: 0, cost: 0, category: type?.category };
      byResourceType[typeName].co2eKg += co2e;
      byResourceType[typeName].cost += cost;
    }

    return {
      summary: { totalCo2eKg, totalCost, totalSavings, totalCarbonExposure: totalExposure, entryCount },
      byDepartment,
      byResourceType,
      generatedAt: this.db.now(),
    };
  }

  submitForApproval(reviewer: AuthenticatedOrgUser, id: string, note?: string) {
    const report = this.getInOrg(reviewer, id);
    if (!['DRAFT', 'REVISION_REQUESTED'].includes(report.status)) {
      throw new BadRequestException('Only draft or revision-requested reports can be submitted.');
    }

    report.status = 'PENDING_APPROVAL';
    report.submissionNote = note?.trim() || null;
    report.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'report.submitted_for_approval',
      entityType: 'report',
      entityId: id,
      metadata: report.submissionNote ? { note: report.submissionNote } : undefined,
    });

    return report;
  }

  // ---------------------------------------------------------------------
  // Executive: approve (freezes permanently) or request revision — per
  // the revised role split, leadership signs off on external disclosures.
  // ---------------------------------------------------------------------
  approve(executive: AuthenticatedOrgUser, id: string, dto: ReportDecisionDto) {
    const report = this.getInOrg(executive, id);
    if (report.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending reports can be approved.');
    }

    if (report.supersedesId) {
      const original = this.db.store.reports.find((r) => r.id === report.supersedesId);
      if (original) original.status = 'SUPERSEDED';
    }

    report.status = 'APPROVED';
    report.approvedById = executive.sub;
    report.approvalComment = dto.comment ?? null;
    report.approvedAt = this.db.now();
    report.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: executive.organizationId,
      orgUserId: executive.sub,
      action: 'report.approved',
      entityType: 'report',
      entityId: id,
    });

    return report;
  }

  requestRevision(executive: AuthenticatedOrgUser, id: string, dto: ReportDecisionDto) {
    const report = this.getInOrg(executive, id);
    if (report.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending reports can be sent back for revision.');
    }

    report.status = 'REVISION_REQUESTED';
    report.approvalComment = dto.comment ?? null;
    report.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: executive.organizationId,
      orgUserId: executive.sub,
      action: 'report.revision_requested',
      entityType: 'report',
      entityId: id,
      metadata: { comment: dto.comment },
    });

    return report;
  }

  /** Creates a new version linked to a report currently flagged for
   * revision. The original is never edited, only marked superseded once
   * the new version is itself approved. */
  createNewVersion(reviewer: AuthenticatedOrgUser, originalId: string) {
    const original = this.getInOrg(reviewer, originalId);
    if (original.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException('A new version can only be created for a report flagged for revision.');
    }

    const content = this.buildContent(reviewer.organizationId, original.periodStart, original.periodEnd);
    const now = this.db.now();

    const newVersion = {
      id: this.db.id(),
      organizationId: reviewer.organizationId,
      title: original.title,
      periodStart: original.periodStart,
      periodEnd: original.periodEnd,
      contentJson: content,
      pdfFilePath: null,
      status: 'DRAFT' as const,
      version: original.version + 1,
      createdById: reviewer.sub,
      approvedById: null,
      approvalComment: null,
      approvedAt: null,
      supersedesId: original.id,
      isScheduled: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.store.reports.push(newVersion);
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'report.new_version_created',
      entityType: 'report',
      entityId: newVersion.id,
      metadata: { supersedes: original.id },
    });

    return newVersion;
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------
  findAll(user: AuthenticatedOrgUser) {
    let reports = this.db.store.reports.filter((r) => r.organizationId === user.organizationId);
    if (user.role === 'EXECUTIVE') {
      // Executives approve reports, so they can see the full pipeline —
      // not just already-approved ones — unlike a purely passive viewer.
    }
    return [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => this.views.report(r));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    return this.views.report(this.getInOrg(user, id));
  }

  private getInOrg(user: AuthenticatedOrgUser, id: string) {
    const report = this.db.store.reports.find((r) => r.id === id && r.organizationId === user.organizationId);
    if (!report) throw new NotFoundException('Report not found.');
    return report;
  }
}
