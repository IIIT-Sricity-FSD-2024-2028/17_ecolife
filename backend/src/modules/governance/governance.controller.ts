import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { appLink } from '../../config/platform.constants';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import crypto from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard, VerifiedEmailGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, assertFacilityScope } from '../../common/guards/roles.guard';
import { lookupUnit } from '../../common/utils/units';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { sha256 } from '../../common/utils/crypto.util';
import { writeAuditLog } from '../../common/utils/audit.util';

const TENANT_ROLES = ['ORG_ADMIN', 'PLANT_MANAGER', 'FINANCE_MANAGER', 'SUSTAINABILITY_LEAD', 'INTERNAL_AUDITOR', 'EXECUTIVE_APPROVER', 'EXTERNAL_VERIFIER'] as const;
const rolesSchema = z.object({ roles: z.array(z.enum(TENANT_ROLES)).min(1).max(TENANT_ROLES.length) });
const statusSchema = z.object({ isActive: z.boolean() });

const inviteSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.enum(['ORG_ADMIN', 'PLANT_MANAGER', 'FINANCE_MANAGER', 'SUSTAINABILITY_LEAD', 'INTERNAL_AUDITOR', 'EXECUTIVE_APPROVER', 'EXTERNAL_VERIFIER'])).min(1),
  facilityIds: z.array(z.string()).default([])
}).refine((v) => !(v.roles.length === 1 && v.roles[0] === 'PLANT_MANAGER') || v.facilityIds.length > 0, { message: 'A Plant Manager must be assigned at least one facility.', path: ['facilityIds'] });

const FY = z.string().regex(/^FY\d{4}-\d{2}$/, 'Use the format FY2025-26');
const decisionSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });
const uarSchema = z.object({ periodLabel: z.string().trim().min(3).max(60), notes: z.string().trim().max(2000).optional() });
const entitySchema = z.object({
  name: z.string().trim().min(2).max(200),
  cin: z.string().trim().toUpperCase().regex(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, 'A CIN has 21 characters, e.g. U29100MH2005PTC123456').optional(),
  parentEntityId: z.string().min(1).optional(),
  ownershipPct: z.number().gt(0).max(100).default(100),
  hasOperationalControl: z.boolean().default(true),
  hasFinancialControl: z.boolean().default(true),
  effectiveFrom: z.coerce.date().optional()
});
const facilitySchema = z.object({
  entityId: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  facilityType: z.enum(['MANUFACTURING_PLANT', 'OFFICE', 'WAREHOUSE', 'DATA_CENTER', 'MINE', 'UTILITY_PLANT', 'OTHER']).default('MANUFACTURING_PLANT'),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  businessUnit: z.string().trim().max(100).optional(),
  isSharedBuilding: z.boolean().default(false),
  floorAreaSharePct: z.number().gt(0).max(100).optional(),
  discomConsumerNo: z.string().trim().max(60).optional(),
  contractDemandKw: z.number().min(0).max(1e6).optional(),
  rooftopSolarKwp: z.number().min(0).max(1e6).default(0),
  meteringMode: z.enum(['STANDARD', 'GROSS_METERING', 'NET_METERING']).default('STANDARD'),
  isWaterStressArea: z.boolean().default(false),
  spcbWaterLimitKl: z.number().positive().max(1e9).optional(),
  effectiveFrom: z.coerce.date().optional()
}).refine((v) => !v.isSharedBuilding || v.floorAreaSharePct != null, { message: 'A shared building needs the share of floor area you occupy.', path: ['floorAreaSharePct'] });
const exclusionSchema = z.object({
  financialYear: FY,
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3']),
  scope3Category: z.number().int().min(1).max(15).optional(),
  facilityId: z.string().min(1).optional(),
  excludedItemName: z.string().trim().min(3).max(200),
  justification: z.string().trim().min(20).max(3000),
  estimatedMaterialityPct: z.number().min(0).max(100).optional()
}).refine((v) => v.scope !== 'SCOPE_3' || v.scope3Category != null, { message: 'Choose the Scope 3 category (1-15).', path: ['scope3Category'] });
const impSchema = z.object({
  financialYear: FY,
  consolidationNarrative: z.string().trim().min(20).max(8000),
  methodologyNarrative: z.string().trim().min(20).max(8000),
  qaQcProcedures: z.string().trim().min(20).max(8000),
  exclusionPolicy: z.string().trim().min(20).max(8000)
});
const factorSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_\-]{3,60}$/, 'Use capital letters, digits, _ or - (3-60 characters)'),
  name: z.string().trim().min(3).max(200),
  domain: z.enum(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT']),
  scope: z.enum(['SCOPE_1', 'SCOPE_2', 'SCOPE_3', 'BIOGENIC', 'NON_GHG']),
  regimeTag: z.enum(['GENERAL', 'BRSR_GHG_PROTOCOL']).default('GENERAL'),
  region: z.string().trim().min(2).max(10).default('IN'),
  sourceAuthority: z.string().trim().min(3).max(300),
  versionLabel: z.string().trim().min(1).max(40).default('v1.0'),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  canonicalUnit: z.string().trim().min(1).max(30),
  co2KgPerUnit: z.number().min(0).max(1e7).default(0),
  ch4KgPerUnit: z.number().min(0).max(1e7).default(0),
  n2oKgPerUnit: z.number().min(0).max(1e7).default(0)
});
const factorDecisionSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) });
const reopenSchema = z.object({ reason: z.string().trim().min(10).max(1000) });
const recalcSchema = z.object({
  triggerType: z.enum(['STRUCTURAL_ACQUISITION', 'STRUCTURAL_DIVESTMENT', 'OUTSOURCING_INSOURCING', 'METHODOLOGY_CHANGE', 'FACTOR_TRUE_UP', 'ERROR_CORRECTION', 'BOUNDARY_CHANGE']),
  affectedPeriodIds: z.array(z.string().min(1)).min(1).max(60),
  estimatedImpactPct: z.number().min(-100).max(1000),
  reason: z.string().trim().min(20).max(3000)
});
const recalcDecisionSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']), decisionNote: z.string().trim().min(5).max(2000).optional() });

@ApiTags('Governance, Team RBAC, Boundary, Factors & Restatements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller()
export class GovernanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('team')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD', 'INTERNAL_AUDITOR', 'EXECUTIVE_APPROVER')
  team(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [users, invitations, certifications] = await Promise.all([
        tx.user.findMany({ take: LEGACY_CAP,
          where: { organizationId: orgId },
          include: { roles: true, facilityAssignments: { include: { facility: { select: { id: true, name: true } } } } },
          orderBy: { createdAt: 'asc' }
        }),
        tx.invitation.findMany({ take: LEGACY_CAP, where: { organizationId: orgId, acceptedAt: null, revokedAt: null }, orderBy: { createdAt: 'desc' } }),
        tx.accessCertification.findMany({ where: { organizationId: orgId }, orderBy: { certifiedAt: 'desc' }, take: 15 })
      ]);
      return {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          isActive: u.isActive,
          twoFactorEnabled: u.twoFactorEnabled,
          lastLoginAt: u.lastLoginAt,
          roles: u.roles.map((r) => r.role),
          facilities: u.facilityAssignments.map((fa) => ({ id: fa.facilityId, name: fa.facility.name }))
        })),
        invitations,
        certifications
      };
    });
  }

  @Post('team/invitations')
  @Roles('ORG_ADMIN')
  @UseGuards(VerifiedEmailGuard)
  async createInvite(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(inviteSchema)) input: z.infer<typeof inviteSchema>) {
    const orgId = user.organizationId!;
    const rawToken = crypto.randomBytes(24).toString('hex');
    const invitation = await this.prisma.withTenantTx(orgId, async (tx) => {
      const email = input.email.toLowerCase();
      if (await tx.user.findFirst({ where: { organizationId: orgId, email } })) throw new ConflictException('A user with this email is already on your team.');
      const globallyTaken = await this.prisma.withAuthTx({ email }, (atx) => atx.user.findUnique({ where: { email }, select: { id: true } }));
      if (globallyTaken) throw new ConflictException('This email already has a Tropos account. Ask them to use a different address.');
      if (input.facilityIds.length > 0) {
        const n = await tx.facility.count({ where: { id: { in: input.facilityIds }, organizationId: orgId } });
        if (n !== new Set(input.facilityIds).size) throw new BadRequestException('One or more facilities do not belong to your organization.');
      }
      await tx.invitation.updateMany({ where: { organizationId: orgId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      const inv = await tx.invitation.create({
        data: {
          organizationId: orgId,
          email: input.email.toLowerCase(),
          roles: input.roles,
          facilityIds: input.facilityIds,
          tokenHash: sha256(rawToken),
          invitedById: user.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      await tx.emailOutbox.create({
        data: { organizationId: orgId, toEmail: inv.email, subject: 'You have been invited to Tropos ERP', bodyText: `You have been invited to join your company on Tropos. Accept here:\n${appLink('/invite/' + rawToken)}`, category: 'TEAM_INVITATION', status: 'PENDING' }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'INVITATION_CREATED', resourceType: 'Invitation', resourceId: inv.id });
      return inv;
    });
    return { invitation, inviteUrlPath: `/invite/${rawToken}`, rawToken };
  }

  @Delete('team/invitations/:id')
  @Roles('ORG_ADMIN')
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      const r = await tx.invitation.updateMany({ where: { id, organizationId: user.organizationId!, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      if (r.count === 0) throw new NotFoundException('Invitation not found or already used/revoked.');
      return { id, revoked: true };
    });
  }

  /** Active organization admins that would remain if `excludeUserId` lost admin rights. */
  private async otherActiveAdmins(tx: any, orgId: string, excludeUserId: string) {
    return tx.userRole.count({ where: { organizationId: orgId, role: 'ORG_ADMIN', userId: { not: excludeUserId }, user: { isActive: true, organizationId: orgId } } });
  }

  @Patch('team/:userId/roles')
  @Roles('ORG_ADMIN')
  updateRoles(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body(new ZodValidationPipe(rolesSchema)) body: z.infer<typeof rolesSchema>) {
    const orgId = user.organizationId!;
    const roles = [...new Set(body.roles)];
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const target = await tx.user.findFirst({ where: { id: userId, organizationId: orgId } });
      if (!target) throw new NotFoundException('User not found in your organization.');
      if (!roles.includes('ORG_ADMIN') && (await this.otherActiveAdmins(tx, orgId, userId)) === 0) {
        throw new BadRequestException('Cannot remove the last organization administrator. Promote another admin first.');
      }
      await tx.userRole.deleteMany({ where: { organizationId: orgId, userId } });
      await tx.userRole.createMany({ data: roles.map((role) => ({ organizationId: orgId, userId, role, assignedById: user.userId })) });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'USER_ROLES_UPDATED', resourceType: 'User', resourceId: userId, metadata: { roles } });
      return { userId, roles };
    });
  }

  @Patch('team/:userId/status')
  @Roles('ORG_ADMIN')
  toggleUserStatus(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const target = await tx.user.findFirst({ where: { id: userId, organizationId: orgId } });
      if (!target) throw new NotFoundException('User not found in your organization.');
      if (!body.isActive) {
        if (userId === user.userId) throw new BadRequestException('You cannot deactivate your own account.');
        const isAdmin = await tx.userRole.count({ where: { organizationId: orgId, userId, role: 'ORG_ADMIN' } });
        if (isAdmin > 0 && (await this.otherActiveAdmins(tx, orgId, userId)) === 0) {
          throw new BadRequestException('Cannot deactivate the last organization administrator.');
        }
      }
      const u = await tx.user.update({ where: { id: userId }, data: { isActive: body.isActive, deactivatedAt: body.isActive ? null : new Date() } });
      if (!body.isActive) {
        await tx.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: body.isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', resourceType: 'User', resourceId: userId });
      return { id: u.id, isActive: u.isActive };
    });
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.userSession.findMany({ where: { userId: user.userId }, orderBy: { lastActiveAt: 'desc' }, take: 25 })
    );
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.userSession.updateMany({ where: { id, userId: user.userId }, data: { revokedAt: new Date() } })
    );
  }

  @Post('access-certifications')
  @Roles('ORG_ADMIN', 'INTERNAL_AUDITOR', 'EXECUTIVE_APPROVER')
  certifyUar(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(uarSchema)) input: z.infer<typeof uarSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const users = await tx.user.findMany({ where: { organizationId: orgId }, include: { roles: true, facilityAssignments: true } });
      const snapshot = users.map((u) => ({ userId: u.id, email: u.email, isActive: u.isActive, twoFactorEnabled: u.twoFactorEnabled, lastLoginAt: u.lastLoginAt ?? null, roles: u.roles.map((r) => r.role), facilityIds: u.facilityAssignments.map((f) => f.facilityId) }));
      const cert = await tx.accessCertification.create({ data: { organizationId: orgId, periodLabel: input.periodLabel, certifiedById: user.userId, snapshotJson: snapshot, notes: input.notes } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'UAR_CERTIFIED', resourceType: 'AccessCertification', resourceId: cert.id, metadata: { users: snapshot.length } });
      return cert;
    });
  }

  @Get('entities')
  entities(@CurrentUser() user: AuthUser, @Query() q: { page?: string; pageSize?: string } = {}) {
    const paging = parsePaging(q);
    const where = { organizationId: user.organizationId! };
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      const [items, total] = await Promise.all([
        tx.entity.findMany({ take: paging.take, skip: paging.skip, where, include: { facilities: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
        paging.paged ? tx.entity.count({ where }) : Promise.resolve(0)
      ]);
      return pageResult(paging, items, total);
    });
  }

  /** Boundary changes take effect from the date given, defaulting to the start of the oldest reporting period (never a hard-coded date). */
  private async boundaryStart(tx: any, orgId: string, given?: Date) {
    if (given) return given;
    const first = await tx.reportingPeriod.findFirst({ where: { organizationId: orgId }, orderBy: { startDate: 'asc' }, select: { startDate: true } });
    if (first) return first.startDate as Date;
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  }

  @Post('entities')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createEntity(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(entitySchema)) input: z.infer<typeof entitySchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (input.parentEntityId && !(await tx.entity.findFirst({ where: { id: input.parentEntityId, organizationId: orgId } }))) throw new BadRequestException('The parent entity is not in your organization.');
      if (input.cin && (await tx.entity.findFirst({ where: { organizationId: orgId, cin: input.cin } }))) throw new ConflictException('An entity with this CIN already exists.');
      const e = await tx.entity.create({
        data: { organizationId: orgId, name: input.name, cin: input.cin ?? null, parentEntityId: input.parentEntityId ?? null, ownershipPct: input.ownershipPct, hasOperationalControl: input.hasOperationalControl, hasFinancialControl: input.hasFinancialControl, effectiveFrom: await this.boundaryStart(tx, orgId, input.effectiveFrom), approvalStatus: 'PENDING' }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'ENTITY_CREATED', resourceType: 'Entity', resourceId: e.id, metadata: { name: input.name, ownershipPct: input.ownershipPct } });
      return e;
    });
  }

  @Patch('entities/:id/approve')
  @Roles('EXECUTIVE_APPROVER', 'ORG_ADMIN')
  approveEntity(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(decisionSchema)) input: z.infer<typeof decisionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.entity.updateMany({ where: { id, organizationId: orgId, approvalStatus: 'PENDING' }, data: { approvalStatus: input.status, approvedById: user.userId, approvedAt: new Date() } });
      if (r.count === 0) throw new ConflictException('Only an entity awaiting approval can be decided.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `ENTITY_${input.status}`, resourceType: 'Entity', resourceId: id });
      return tx.entity.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('facilities')
  @Roles('ORG_ADMIN', 'SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createFacility(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(facilitySchema)) input: z.infer<typeof facilitySchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const entity = await tx.entity.findFirst({ where: { id: input.entityId, organizationId: orgId } });
      if (!entity) throw new BadRequestException('The entity is not in your organization.');
      if (entity.approvalStatus === 'REJECTED') throw new BadRequestException('That entity was rejected.');
      const { effectiveFrom, ...rest } = input;
      const f = await tx.facility.create({ data: { organizationId: orgId, ...rest, effectiveFrom: await this.boundaryStart(tx, orgId, effectiveFrom), approvalStatus: 'PENDING' } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'FACILITY_CREATED', resourceType: 'Facility', resourceId: f.id, metadata: { name: input.name } });
      return f;
    });
  }

  @Patch('facilities/:id/approve')
  @Roles('EXECUTIVE_APPROVER', 'ORG_ADMIN')
  approveFacility(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(decisionSchema)) input: z.infer<typeof decisionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.facility.updateMany({ where: { id, organizationId: orgId, approvalStatus: 'PENDING' }, data: { approvalStatus: input.status, approvedById: user.userId } });
      if (r.count === 0) throw new ConflictException('Only a facility awaiting approval can be decided.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `FACILITY_${input.status}`, resourceType: 'Facility', resourceId: id });
      return tx.facility.findUniqueOrThrow({ where: { id } });
    });
  }

  @Get('boundary-exclusions')
  exclusions(@CurrentUser() user: AuthUser, @Query() q: { page?: string; pageSize?: string } = {}) {
    const paging = parsePaging(q);
    const where = { organizationId: user.organizationId! };
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      const [items, total] = await Promise.all([
        tx.boundaryExclusion.findMany({ take: paging.take, skip: paging.skip, where, include: { facility: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
        paging.paged ? tx.boundaryExclusion.count({ where }) : Promise.resolve(0)
      ]);
      return pageResult(paging, items, total);
    });
  }

  @Post('boundary-exclusions')
  @Roles('SUSTAINABILITY_LEAD', 'PLANT_MANAGER')
  createExclusion(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(exclusionSchema)) input: z.infer<typeof exclusionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      if (input.facilityId) {
        if (!(await tx.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } }))) throw new BadRequestException('Facility not found in your organization.');
        if (!assertFacilityScope(user, input.facilityId)) throw new ForbiddenException('You are not assigned to that facility.');
      } else if (!user.roles.includes('SUSTAINABILITY_LEAD')) {
        throw new ForbiddenException('Organization-wide exclusions are raised by the Sustainability Lead.');
      }
      const x = await tx.boundaryExclusion.create({ data: { organizationId: orgId, ...input, facilityId: input.facilityId ?? null, scope3Category: input.scope === 'SCOPE_3' ? input.scope3Category! : null, estimatedMaterialityPct: input.estimatedMaterialityPct ?? null, status: 'PENDING', requestedById: user.userId } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'BOUNDARY_EXCLUSION_REQUESTED', resourceType: 'BoundaryExclusion', resourceId: x.id, metadata: { item: input.excludedItemName, materialityPct: input.estimatedMaterialityPct ?? null } });
      return x;
    });
  }

  @Patch('boundary-exclusions/:id/decide')
  @Roles('EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD')
  decideExclusion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(decisionSchema)) input: z.infer<typeof decisionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const x = await tx.boundaryExclusion.findFirst({ where: { id, organizationId: orgId } });
      if (!x) throw new NotFoundException('Exclusion not found.');
      if (x.requestedById === user.userId) throw new ForbiddenException('You raised this exclusion, so someone else must decide it.');
      const r = await tx.boundaryExclusion.updateMany({ where: { id, status: 'PENDING' }, data: { status: input.status, approvedById: user.userId, approvedAt: new Date() } });
      if (r.count === 0) throw new ConflictException('This exclusion has already been decided.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `BOUNDARY_EXCLUSION_${input.status}`, resourceType: 'BoundaryExclusion', resourceId: id });
      return tx.boundaryExclusion.findUniqueOrThrow({ where: { id } });
    });
  }

  @Get('imp')
  imps(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.inventoryManagementPlan.findMany({ where: { organizationId: user.organizationId! }, orderBy: [{ financialYear: 'desc' }, { version: 'desc' }] })
    );
  }

  @Post('imp')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createImp(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(impSchema)) input: z.infer<typeof impSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const latest = await tx.inventoryManagementPlan.findFirst({ where: { organizationId: orgId, financialYear: input.financialYear }, orderBy: { version: 'desc' } });
      const created = await tx.inventoryManagementPlan.create({ data: { organizationId: orgId, ...input, version: (latest?.version ?? 0) + 1, status: 'PENDING', authoredById: user.userId } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'IMP_AUTHORED', resourceType: 'InventoryManagementPlan', resourceId: created.id, metadata: { financialYear: input.financialYear, version: created.version } });
      return created;
    });
  }

  @Patch('imp/:id/approve')
  @Roles('EXECUTIVE_APPROVER')
  approveImp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const p = await tx.inventoryManagementPlan.findFirst({ where: { id, organizationId: orgId } });
      if (!p) throw new NotFoundException('Plan not found.');
      if (p.status !== 'PENDING') throw new ConflictException('Only a plan awaiting approval can be approved.');
      if (p.authoredById === user.userId) throw new ForbiddenException('You wrote this plan, so someone else must approve it.');
      await tx.inventoryManagementPlan.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.userId, approvedAt: new Date() } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'IMP_APPROVED', resourceType: 'InventoryManagementPlan', resourceId: id });
      return tx.inventoryManagementPlan.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('factors')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createFactor(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(factorSchema)) input: z.infer<typeof factorSchema>) {
    const orgId = user.organizationId!;
    try { lookupUnit(input.canonicalUnit); } catch (e: any) { throw new BadRequestException(e?.message ?? 'Unknown unit.'); }
    if (input.validTo && input.validTo <= input.validFrom) throw new BadRequestException('The validity end must be after the start.');
    if (!(input.co2KgPerUnit > 0 || input.ch4KgPerUnit > 0 || input.n2oKgPerUnit > 0)) throw new BadRequestException('A factor needs a CO2, CH4 or N2O value above zero.');
    return this.prisma.withTenantTx(orgId, async (tx) => {
      try {
        const f = await tx.emissionFactor.create({ data: { organizationId: orgId, ...input, tier: 'SITE_LAB_CUSTOM', status: 'PENDING_APPROVAL', createdById: user.userId } });
        await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'FACTOR_PROPOSED', resourceType: 'EmissionFactor', resourceId: f.id, metadata: { code: input.code } });
        return f;
      } catch (e: any) {
        if (e?.code === 'P2002') throw new ConflictException(`A factor with code ${input.code} (same version) already exists.`);
        throw e;
      }
    });
  }

  @Patch('factors/:id/approve')
  @Roles('EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD')
  approveFactor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(factorDecisionSchema)) input: z.infer<typeof factorDecisionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const f = await tx.emissionFactor.findFirst({ where: { id, organizationId: orgId } });
      if (!f) throw new NotFoundException('Factor not found (only your own custom factors can be approved here).');
      if (f.status !== 'PENDING_APPROVAL') throw new ConflictException('Only a factor awaiting approval can be decided.');
      if (f.createdById === user.userId) throw new ForbiddenException('You proposed this factor, so someone else must approve it.');
      await tx.emissionFactor.update({ where: { id }, data: { status: input.decision, isLocked: input.decision === 'APPROVED', approvedById: user.userId, approvedAt: new Date() } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `FACTOR_${input.decision}`, resourceType: 'EmissionFactor', resourceId: id });
      return tx.emissionFactor.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('periods/:id/sign-off')
  @Roles('EXECUTIVE_APPROVER')
  signOffPeriod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const period = await tx.reportingPeriod.findFirst({ where: { id, organizationId: orgId } });
      if (!period) throw new NotFoundException('Period not found.');
      if (period.status !== 'CLOSED') throw new ConflictException(`${period.label} is ${period.status.toLowerCase().replace('_', ' ')}. Only a closed period can be signed off.`);
      const updated = await tx.reportingPeriod.update({ where: { id }, data: { status: 'SIGNED_OFF', signedOffAt: new Date(), signedOffById: user.userId } });
      const entryIds = (await tx.resourceEntry.findMany({ where: { periodId: id }, select: { id: true } })).map((e) => e.id);
      if (entryIds.length > 0) await tx.evidenceFile.updateMany({ where: { entryId: { in: entryIds } }, data: { isLocked: true } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'PERIOD_EXECUTIVE_SIGNED_OFF', resourceType: 'ReportingPeriod', resourceId: id });
      return updated;
    });
  }

  @Post('periods/:id/reopen')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  reopenPeriod(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(reopenSchema)) input: z.infer<typeof reopenSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const period = await tx.reportingPeriod.findFirst({ where: { id, organizationId: orgId } });
      if (!period) throw new NotFoundException('Period not found.');
      if (!['CLOSED', 'SIGNED_OFF'].includes(period.status)) throw new ConflictException(`${period.label} is ${period.status.toLowerCase()}; only a closed or signed-off period can be reopened.`);
      if (period.status === 'SIGNED_OFF' && !user.roles.includes('EXECUTIVE_APPROVER')) throw new ForbiddenException('A signed-off period can be reopened only by an Executive Approver.');
      const updated = await tx.reportingPeriod.update({ where: { id }, data: { status: 'REOPENED', reopenCount: { increment: 1 }, lastReopenNote: input.reason, signedOffAt: null, signedOffById: null } });
      // Evidence locked at sign-off stays locked: chain of custody must never be broken. New evidence can still be attached.
      const linked = await tx.assuranceEngagementPeriod.findMany({ where: { periodId: id }, select: { engagementId: true } });
      if (linked.length > 0) await tx.assuranceEngagement.updateMany({ where: { id: { in: linked.map((l) => l.engagementId) } }, data: { periodModifiedAlert: true } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'PERIOD_REOPENED', resourceType: 'ReportingPeriod', resourceId: id, metadata: { reason: input.reason, from: period.status } });
      return updated;
    });
  }

  @Get('recalculations')
  recalculations(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.recalculationRequest.findMany({ take: LEGACY_CAP, where: { organizationId: user.organizationId! }, orderBy: { createdAt: 'desc' } })
    );
  }

  @Post('recalculations')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  createRecalc(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(recalcSchema)) input: z.infer<typeof recalcSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const ids = [...new Set(input.affectedPeriodIds)];
      if ((await tx.reportingPeriod.count({ where: { id: { in: ids }, organizationId: orgId } })) !== ids.length) throw new BadRequestException('One or more affected periods were not found.');
      // GHG Protocol: the base-year significance test is cumulative over all approved changes, so earlier approvals count too.
      const prior = await tx.recalculationRequest.findMany({ where: { organizationId: orgId, status: 'APPROVED' } });
      const cumulative = prior.reduce((s, r) => s + Math.abs(Number(r.estimatedImpactPct)), 0) + Math.abs(input.estimatedImpactPct);
      const row = await tx.recalculationRequest.create({ data: { organizationId: orgId, triggerType: input.triggerType, affectedPeriodIds: ids, estimatedImpactPct: input.estimatedImpactPct, cumulativeImpactPct: cumulative, reason: input.reason, status: 'PENDING', requestedById: user.userId } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'RECALCULATION_REQUESTED', resourceType: 'RecalculationRequest', resourceId: row.id, metadata: { trigger: input.triggerType, impactPct: input.estimatedImpactPct, cumulativePct: cumulative } });
      return row;
    });
  }

  @Patch('recalculations/:id/decide')
  @Roles('EXECUTIVE_APPROVER')
  decideRecalc(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(recalcDecisionSchema)) input: z.infer<typeof recalcDecisionSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r0 = await tx.recalculationRequest.findFirst({ where: { id, organizationId: orgId } });
      if (!r0) throw new NotFoundException('Request not found.');
      if (r0.requestedById === user.userId) throw new ForbiddenException('You raised this request, so someone else must decide it.');
      if (input.status === 'REJECTED' && !input.decisionNote) throw new BadRequestException('Give the reason for rejecting (at least 5 characters).');
      const claimed = await tx.recalculationRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: input.status, decidedById: user.userId, decidedAt: new Date(), decisionNote: input.decisionNote ?? null } });
      if (claimed.count === 0) throw new ConflictException('This request has already been decided.');
      if (input.status === 'APPROVED') {
        const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
        if (Number(r0.cumulativeImpactPct) >= Number(org.significanceThresholdPct)) await tx.target.updateMany({ where: { organizationId: orgId }, data: { needsBaseRestatement: true } });
      }
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `RECALCULATION_${input.status}`, resourceType: 'RecalculationRequest', resourceId: id });
      return tx.recalculationRequest.findUniqueOrThrow({ where: { id } });
    });
  }
}
