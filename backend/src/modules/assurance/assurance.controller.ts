import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { writeAuditLog } from '../../common/utils/audit.util';

const internalFindingSchema = z.object({
  periodId: z.string().min(1).optional(),
  controlDomain: z.string().trim().min(2).max(80),
  status: z.enum(['PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED']).default('DEFICIENCY'),
  summary: z.string().trim().min(10).max(2000),
  remediation: z.string().trim().min(5).max(2000).optional()
});
const internalFindingUpdateSchema = z.object({
  status: z.enum(['PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED', 'CLOSED']).optional(),
  remediation: z.string().trim().min(5).max(2000).optional()
}).refine((v) => v.status || v.remediation, 'Send a status or a remediation.');
const engagementSchema = z.object({
  verifierUserId: z.string().min(1),
  verifierFirmName: z.string().trim().min(2).max(200),
  acvaAccreditationNo: z.string().trim().min(2).max(60).optional(),
  engagementType: z.enum(['ASSURANCE', 'ASSESSMENT', 'VALIDATION', 'VERIFICATION']).default('ASSURANCE'),
  assuranceLevel: z.enum(['LIMITED', 'REASONABLE']).default('LIMITED'),
  standard: z.enum(['INTERNAL_TRACKING', 'SEBI_ISF_ASSESSMENT', 'ICAI_SSAE_3000', 'ICAI_SSAE_3410', 'ISO_14064_3', 'ISSA_5000', 'BEE_CCTS_ACVA']),
  materialityThresholdPct: z.number().min(0.1).max(20).default(5),
  periodIds: z.array(z.string().min(1)).max(60).default([])
});
const findingSchema = z.object({
  periodId: z.string().min(1),
  entryId: z.string().min(1).optional(),
  severity: z.enum(['CLARIFICATION', 'MATERIAL_MISSTATEMENT', 'NONCONFORMITY']).default('CLARIFICATION'),
  questionText: z.string().trim().min(10).max(2000)
});
const respondSchema = z.object({ responseText: z.string().trim().min(10).max(4000) });
const closeSchema = z.object({ status: z.enum(['RESOLVED', 'UNRESOLVED']) });
const opinionSchema = z.object({ opinion: z.enum(['UNMODIFIED', 'QUALIFIED', 'ADVERSE', 'DISCLAIMER']), opinionNotes: z.string().trim().min(20).max(5000) });

@ApiTags('Internal Audit, External Assurance & Immutable Audit Trail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller()
export class AssuranceController {
  constructor(private readonly prisma: PrismaService) {}

  /** The activity log. No paging: the latest 200 (old shape). With page/pageSize: paged; ?q, ?resourceType, ?actorId, ?from, ?to narrow it. Each row carries the actor's name. */
  @Get('audit-logs')
  @Roles('INTERNAL_AUDITOR', 'EXTERNAL_VERIFIER', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN')
  auditLogs(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const orgId = user.organizationId!;
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const day = (v: any) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };
    const from = q.from ? day(q.from) : null, to = q.to ? day(q.to) : null;
    if ((q.from && !from) || (q.to && !to)) throw new BadRequestException('Dates must look like 2026-04-01.');
    const where: any = {
      organizationId: orgId,
      ...(q.resourceType ? { resourceType: String(q.resourceType) } : {}), ...(q.actorId ? { actorId: String(q.actorId) } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}) } } : {}),
      ...(term ? { OR: [{ action: { contains: term, mode: 'insensitive' } }, { resourceType: { contains: term, mode: 'insensitive' } }] } : {})
    };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const paging = paged ? parsePaging(q) : null;
      const rows = await tx.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: paging ? paging.skip : 0, take: paging ? paging.take : 200 });
      const users = await tx.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, fullName: true } });
      const name = new Map(users.map((u) => [u.id, u.fullName]));
      const items = rows.map((r) => ({ ...r, actorName: name.get(r.actorId) ?? null }));
      if (!paging) return items;
      return pageResult(paging, items, await tx.auditLog.count({ where }));
    });
  }

  @Get('internal-audit/findings')
  @Roles('INTERNAL_AUDITOR', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN')
  internalFindings(@CurrentUser() user: AuthUser, @Query() q: { page?: string; pageSize?: string } = {}) {
    const paging = parsePaging(q);
    const where = { organizationId: user.organizationId! };
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      const [items, total] = await Promise.all([
        tx.internalAuditFinding.findMany({ take: paging.take, skip: paging.skip, where, include: { period: { select: { label: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
        paging.paged ? tx.internalAuditFinding.count({ where }) : Promise.resolve(0)
      ]);
      return pageResult(paging, items, total);
    });
  }

  @Post('internal-audit/findings')
  @Roles('INTERNAL_AUDITOR')
  createInternalFinding(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(internalFindingSchema)) input: z.infer<typeof internalFindingSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (input.periodId && !(await tx.reportingPeriod.findFirst({ where: { id: input.periodId, organizationId: orgId } }))) throw new BadRequestException('Reporting period not found.');
      if (['DEFICIENCY', 'REMEDIATION_REQUIRED'].includes(input.status) && !input.remediation) throw new BadRequestException('State the remediation the control owner must carry out.');
      const f = await tx.internalAuditFinding.create({
        data: { organizationId: orgId, periodId: input.periodId ?? null, controlDomain: input.controlDomain, status: input.status, summary: input.summary, remediation: input.remediation ?? null, auditorId: user.userId }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'INTERNAL_AUDIT_FINDING_CREATED', resourceType: 'InternalAuditFinding', resourceId: f.id, metadata: { status: input.status, domain: input.controlDomain } });
      return f;
    });
  }

  @Patch('internal-audit/findings/:id')
  @Roles('INTERNAL_AUDITOR', 'SUSTAINABILITY_LEAD')
  updateInternalFinding(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(internalFindingUpdateSchema)) input: z.infer<typeof internalFindingUpdateSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const f = await tx.internalAuditFinding.findFirst({ where: { id, organizationId: orgId } });
      if (!f) throw new NotFoundException('Finding not found.');
      // Only the auditor decides whether a control passes or the finding is closed; the control owner can only describe remediation.
      const isAuditor = user.roles.includes('INTERNAL_AUDITOR');
      if (input.status && !isAuditor) throw new ForbiddenException('Only the internal auditor can change the status of a finding.');
      const next = input.status ?? f.status;
      const remediation = input.remediation ?? f.remediation;
      if (next === 'CLOSED' && !remediation) throw new BadRequestException('Record the remediation before closing the finding.');
      const updated = await tx.internalAuditFinding.update({ where: { id }, data: { status: next, remediation } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'INTERNAL_AUDIT_FINDING_UPDATED', resourceType: 'InternalAuditFinding', resourceId: id, metadata: { from: f.status, to: next } });
      return updated;
    });
  }

  @Get('assurance/engagements')
  @Roles('EXTERNAL_VERIFIER', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'INTERNAL_AUDITOR', 'ORG_ADMIN')
  engagements(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.assuranceEngagement.findMany({ take: LEGACY_CAP,
        where: { organizationId: user.organizationId! },
        include: {
          verifier: { select: { id: true, fullName: true, email: true } },
          periods: { include: { period: { select: { id: true, label: true, status: true, reopenCount: true } } } },
          findings: { include: { period: { select: { label: true } } }, orderBy: { createdAt: 'desc' } }
        },
        orderBy: { createdAt: 'desc' }
      })
    );
  }

  @Post('assurance/engagements')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN')
  createEngagement(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(engagementSchema)) input: z.infer<typeof engagementSchema>) {
    const orgId = user.organizationId!;
    if (input.standard === 'BEE_CCTS_ACVA' && !input.acvaAccreditationNo) throw new BadRequestException('A BEE CCTS engagement needs the verifier\'s ACVA accreditation number.');
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const verifier = await tx.user.findFirst({ where: { id: input.verifierUserId, organizationId: orgId, isActive: true, roles: { some: { organizationId: orgId, role: 'EXTERNAL_VERIFIER' } } } });
      if (!verifier) throw new BadRequestException('Choose an active user in your organization who holds the External Verifier role.');
      if (input.periodIds.length) {
        const n = await tx.reportingPeriod.count({ where: { id: { in: input.periodIds }, organizationId: orgId } });
        if (n !== new Set(input.periodIds).size) throw new BadRequestException('One or more reporting periods were not found.');
      }
      // BEE rule: the ACVA that validated a project cannot also verify it (and vice versa).
      if (input.acvaAccreditationNo && ['VALIDATION', 'VERIFICATION'].includes(input.engagementType)) {
        const opposite = input.engagementType === 'VALIDATION' ? 'VERIFICATION' : 'VALIDATION';
        const clash = await tx.assuranceEngagement.findFirst({ where: { organizationId: orgId, acvaAccreditationNo: input.acvaAccreditationNo, engagementType: opposite, status: { not: 'CANCELLED' } } });
        if (clash) throw new ConflictException('This ACVA already holds the opposite engagement (validation vs verification). The same body cannot do both.');
      }
      const eng = await tx.assuranceEngagement.create({
        data: {
          organizationId: orgId,
          verifierUserId: verifier.id,
          verifierFirmName: input.verifierFirmName,
          acvaAccreditationNo: input.acvaAccreditationNo ?? null,
          engagementType: input.engagementType,
          assuranceLevel: input.assuranceLevel,
          standard: input.standard,
          materialityThresholdPct: input.materialityThresholdPct,
          status: 'IN_PROGRESS',
          createdById: user.userId
        }
      });
      if (input.periodIds.length > 0) {
        await tx.assuranceEngagementPeriod.createMany({ data: [...new Set(input.periodIds)].map((periodId) => ({ organizationId: orgId, engagementId: eng.id, periodId })) });
      }
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ASSURANCE_ENGAGEMENT_CREATED', resourceType: 'AssuranceEngagement', resourceId: eng.id, metadata: { verifier: verifier.email, standard: input.standard, level: input.assuranceLevel } });
      return eng;
    });
  }

  /** The caller must be the verifier named on the engagement; internal auditors can read but not conclude it. */
  private async ownEngagement(tx: any, orgId: string, user: AuthUser, id: string, mustBeOpen = true) {
    const eng = await tx.assuranceEngagement.findFirst({ where: { id, organizationId: orgId } });
    if (!eng) throw new NotFoundException('Engagement not found.');
    if (user.roles.includes('EXTERNAL_VERIFIER') && eng.verifierUserId !== user.userId) throw new ForbiddenException('This engagement is assigned to a different verifier.');
    if (mustBeOpen && eng.status !== 'IN_PROGRESS') throw new ConflictException(`This engagement is ${eng.status.toLowerCase().replace('_', ' ')}.`);
    return eng;
  }

  @Post('assurance/engagements/:id/findings')
  @Roles('EXTERNAL_VERIFIER', 'INTERNAL_AUDITOR')
  raiseFinding(@CurrentUser() user: AuthUser, @Param('id') engagementId: string, @Body(new ZodValidationPipe(findingSchema)) input: z.infer<typeof findingSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      await this.ownEngagement(tx, orgId, user, engagementId);
      const linked = await tx.assuranceEngagementPeriod.findFirst({ where: { engagementId, periodId: input.periodId } });
      if (!linked) throw new BadRequestException('That period is not part of this engagement.');
      if (input.entryId && !(await tx.resourceEntry.findFirst({ where: { id: input.entryId, organizationId: orgId, periodId: input.periodId } }))) throw new BadRequestException('That entry does not belong to the chosen period.');
      const f = await tx.verificationFinding.create({
        data: { organizationId: orgId, engagementId, periodId: input.periodId, entryId: input.entryId ?? null, severity: input.severity, status: 'OPEN', questionText: input.questionText, raisedById: user.userId }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ASSURANCE_FINDING_RAISED', resourceType: 'VerificationFinding', resourceId: f.id, metadata: { severity: input.severity } });
      return f;
    });
  }

  @Patch('assurance/findings/:id/respond')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'PLANT_MANAGER')
  respondFinding(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(respondSchema)) input: z.infer<typeof respondSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.verificationFinding.updateMany({ where: { id, organizationId: orgId, status: { in: ['OPEN', 'UNRESOLVED'] }, engagement: { status: 'IN_PROGRESS' } }, data: { responseText: input.responseText, status: 'RESPONDED', respondedById: user.userId, respondedAt: new Date(), closedAt: null } });
      if (r.count === 0) throw new ConflictException('This finding is not open for a response (it may already be answered, resolved, or the engagement is finished).');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ASSURANCE_FINDING_RESPONDED', resourceType: 'VerificationFinding', resourceId: id });
      return tx.verificationFinding.findUniqueOrThrow({ where: { id } });
    });
  }

  @Patch('assurance/findings/:id/close')
  @Roles('EXTERNAL_VERIFIER')
  closeFinding(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(closeSchema)) input: z.infer<typeof closeSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const f = await tx.verificationFinding.findFirst({ where: { id, organizationId: orgId } });
      if (!f) throw new NotFoundException('Finding not found.');
      await this.ownEngagement(tx, orgId, user, f.engagementId);
      if (f.status !== 'RESPONDED') throw new ConflictException('The finding can be closed only after the company has responded.');
      const updated = await tx.verificationFinding.update({ where: { id }, data: { status: input.status, closedAt: new Date() } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ASSURANCE_FINDING_CLOSED', resourceType: 'VerificationFinding', resourceId: id, metadata: { status: input.status } });
      return updated;
    });
  }

  @Post('assurance/engagements/:id/opinion')
  @Roles('EXTERNAL_VERIFIER')
  issueOpinion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(opinionSchema)) input: z.infer<typeof opinionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      await this.ownEngagement(tx, orgId, user, id);
      const periods = await tx.assuranceEngagementPeriod.findMany({ where: { engagementId: id }, include: { period: { select: { label: true, status: true } } } });
      if (periods.length === 0) throw new BadRequestException('The engagement covers no reporting period.');
      const notClosed = periods.filter((p) => !['CLOSED', 'SIGNED_OFF'].includes(p.period.status));
      if (notClosed.length) throw new ConflictException(`An opinion needs closed periods. Still open: ${notClosed.map((p) => p.period.label).join(', ')}.`);
      const findings = await tx.verificationFinding.findMany({ where: { engagementId: id } });
      const open = findings.filter((f) => ['OPEN', 'RESPONDED'].includes(f.status));
      if (open.length) throw new ConflictException(`${open.length} finding${open.length === 1 ? ' is' : 's are'} still open. Resolve or mark each unresolved before issuing an opinion.`);
      const serious = findings.filter((f) => f.status === 'UNRESOLVED' && f.severity !== 'CLARIFICATION');
      if (input.opinion === 'UNMODIFIED' && serious.length) throw new BadRequestException('An unmodified opinion is not possible while a material misstatement or nonconformity is unresolved. Choose a qualified, adverse or disclaimer opinion.');
      const eng = await tx.assuranceEngagement.update({ where: { id }, data: { opinion: input.opinion, opinionNotes: input.opinionNotes, status: 'OPINION_ISSUED', opinionIssuedAt: new Date() } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ASSURANCE_OPINION_ISSUED', resourceType: 'AssuranceEngagement', resourceId: id, metadata: { opinion: input.opinion } });
      return eng;
    });
  }
}
