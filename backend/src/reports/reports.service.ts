import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { GenerateReportDto, ReportDecisionDto, UpdateReportDto } from './dto/report.dto';

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
      notes: dto.notes?.trim() || null,
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
    let totalCo2eLocationKg = 0;
    let totalCo2eMarketKg = 0;
    let totalCost = 0;
    let totalSavings = 0;
    let totalExposure = 0;
    let entryCount = 0;
    let entriesWithoutCalculation = 0;

    for (const record of records) {
      const calc = this.db.store.calculationResults.find((c) => c.resourceRecordId === record.id && !c.supersededAt);
      if (!calc) {
        entriesWithoutCalculation++;
        continue;
      }
      entryCount++;

      const dept = this.db.store.departments.find((d) => d.id === record.departmentId);
      const type = this.db.store.resourceTypes.find((t) => t.id === record.resourceTypeId);

      const co2e = calc.co2eKg;
      const co2eLocation = calc.co2eLocationKg ?? calc.co2eKg;
      const co2eMarket = calc.co2eMarketKg ?? calc.co2eKg;
      const cost = calc.costOfUsage ?? 0;
      const savings = calc.savingsVsBaseline ?? 0;
      const exposure = calc.carbonExposure ?? 0;

      totalCo2eKg += co2e;
      totalCo2eLocationKg += co2eLocation;
      totalCo2eMarketKg += co2eMarket;
      totalCost += cost;
      totalSavings += savings;
      totalExposure += exposure;

      const deptName = dept?.name ?? 'Unknown';
      byDepartment[deptName] ??= { co2eKg: 0, co2eLocationKg: 0, co2eMarketKg: 0, cost: 0, entries: 0 };
      byDepartment[deptName].co2eKg += co2e;
      byDepartment[deptName].co2eLocationKg += co2eLocation;
      byDepartment[deptName].co2eMarketKg += co2eMarket;
      byDepartment[deptName].cost += cost;
      byDepartment[deptName].entries += 1;

      const typeName = type?.name ?? 'Unknown';
      byResourceType[typeName] ??= {
        co2eKg: 0,
        co2eLocationKg: 0,
        co2eMarketKg: 0,
        cost: 0,
        category: type?.category,
        quantity: 0,
        unit: record.unit,
      };
      byResourceType[typeName].co2eKg += co2e;
      byResourceType[typeName].co2eLocationKg += co2eLocation;
      byResourceType[typeName].co2eMarketKg += co2eMarket;
      byResourceType[typeName].cost += cost;
      byResourceType[typeName].quantity += record.quantity;
      byResourceType[typeName].unit = record.unit;
    }

    return {
      summary: {
        totalCo2eKg,
        totalCo2eLocationKg,
        totalCo2eMarketKg,
        totalCost,
        totalSavings,
        totalCarbonExposure: totalExposure,
        entryCount,
        entriesWithoutCalculation,
      },
      byDepartment,
      byResourceType,
      generatedAt: this.db.now(),
    };
  }

  previewContent(user: AuthenticatedOrgUser, periodStart: string, periodEnd: string) {
    const content = this.buildContent(user.organizationId, periodStart, periodEnd);
    const records = this.db.store.resourceRecords
      .filter(
        (r) =>
          r.organizationId === user.organizationId &&
          r.status === 'LOCKED' &&
          r.periodStart >= periodStart &&
          r.periodEnd <= periodEnd,
      )
      .map((r) => this.views.record(r));

    return {
      ...content,
      records,
    };
  }

  submitForApproval(reviewer: AuthenticatedOrgUser, id: string, note?: string) {
    const report = this.getInOrg(reviewer, id);
    if (!['DRAFT', 'REVISION_REQUESTED'].includes(report.status)) {
      throw new BadRequestException('Only draft or revision-requested reports can be submitted.');
    }

    // Always rebuild content snapshot when submitting so it reflects latest locked data
    report.contentJson = this.buildContent(reviewer.organizationId, report.periodStart, report.periodEnd);
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
  // Executive: approve (freezes permanently) or request revision
  // ---------------------------------------------------------------------
  approve(executive: AuthenticatedOrgUser, id: string, dto: ReportDecisionDto) {
    const report = this.getInOrg(executive, id);
    if (report.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending reports can be approved.');
    }

    // Check for stale snapshot: verify that underlying data hasn't changed since submission
    const fresh = this.buildContent(executive.organizationId, report.periodStart, report.periodEnd);
    const existingContent = report.contentJson as { summary?: Record<string, any> } | null;
    if (existingContent?.summary && typeof existingContent.summary.entryCount === 'number') {
      const s = existingContent.summary;
      const f = fresh.summary;
      const isStale =
        s.totalCo2eKg !== f.totalCo2eKg ||
        s.totalCost !== f.totalCost ||
        s.entryCount !== f.entryCount ||
        s.entriesWithoutCalculation !== f.entriesWithoutCalculation ||
        s.totalSavings !== f.totalSavings ||
        s.totalCarbonExposure !== f.totalCarbonExposure;

      if (isStale) {
        throw new BadRequestException(
          'Underlying data has changed since this report was submitted. Send it back for revision.',
        );
      }
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
      notes: original.notes ?? null,
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

  update(reviewer: AuthenticatedOrgUser, id: string, dto: UpdateReportDto) {
    const report = this.getInOrg(reviewer, id);
    if (report.status !== 'DRAFT') {
      throw new BadRequestException('Only draft reports can be edited. For reports sent back for revision, please create a new version.');
    }

    if (dto.title !== undefined && dto.title.trim()) {
      report.title = dto.title.trim();
    }
    if (dto.notes !== undefined) {
      report.notes = dto.notes ? dto.notes.trim() : null;
    }
    if (dto.submissionNote !== undefined) {
      report.submissionNote = dto.submissionNote ? dto.submissionNote.trim() : null;
    }

    if (
      (dto.periodStart && dto.periodStart !== report.periodStart) ||
      (dto.periodEnd && dto.periodEnd !== report.periodEnd)
    ) {
      report.periodStart = dto.periodStart || report.periodStart;
      report.periodEnd = dto.periodEnd || report.periodEnd;
      report.contentJson = this.buildContent(reviewer.organizationId, report.periodStart, report.periodEnd);
    }

    report.updatedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: reviewer.organizationId,
      orgUserId: reviewer.sub,
      action: 'report.updated',
      entityType: 'report',
      entityId: id,
    });

    return this.views.report(report);
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------
  findAll(user: AuthenticatedOrgUser) {
    const reports = this.db.store.reports.filter((r) => r.organizationId === user.organizationId);
    return [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((r) => this.views.report(r));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    return this.views.report(this.getInOrg(user, id));
  }

  /** Minimal self-contained PDF of an authorized report snapshot/revision. */
  exportPdf(user: AuthenticatedOrgUser, id: string) {
    const report = this.getInOrg(user, id);
    const text = `${report.title} (v${report.version})\nPeriod: ${report.periodStart} to ${report.periodEnd}\nStatus: ${report.status}\n\n${JSON.stringify(report.contentJson)}`.replace(/[()\\]/g, '\\$&').replace(/[\r\n]+/g, ' ');
    const stream = `BT /F1 10 Tf 50 750 Td (${text.slice(0, 5000)}) Tj ET`;
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    this.auditLog.log({ organizationId: user.organizationId, orgUserId: user.sub, action: 'report.exported_pdf', entityType: 'report', entityId: id, metadata: { version: report.version } });
    return Buffer.from(pdf, 'utf8');
  }

  private getInOrg(user: AuthenticatedOrgUser, id: string) {
    const report = this.db.store.reports.find((r) => r.id === id && r.organizationId === user.organizationId);
    if (!report) throw new NotFoundException('Report not found.');
    return report;
  }

  remove(user: AuthenticatedOrgUser, id: string) {
    const report = this.getInOrg(user, id);
    if (report.status !== 'DRAFT') {
      throw new BadRequestException('Only unsubmitted draft reports can be deleted.');
    }

    const idx = this.db.store.reports.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.db.store.reports.splice(idx, 1);
      this.db.persist();
    }

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'report.deleted',
      entityType: 'report',
      entityId: id,
      metadata: { title: report.title },
    });

    return { id };
  }
}
