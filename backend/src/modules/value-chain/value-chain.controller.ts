import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { appLink } from '../../config/platform.constants';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { assertFacilityScope } from '../../common/guards/roles.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { sha256 } from '../../common/utils/crypto.util';
import { writeAuditLog } from '../../common/utils/audit.util';
import { convertToCanonical, lookupUnit } from '../../common/utils/units';

const utcDate = z.coerce.date();
const supplierSchema = z.object({
  name: z.string().trim().min(2).max(200),
  contactEmail: z.string().trim().toLowerCase().email().max(200),
  category: z.string().trim().min(2).max(120),
  isTop2PctPartner: z.boolean().default(false),
  tradeSharePct: z.number().min(0).max(100).optional()
});
const creditSchema = z.object({
  entityId: z.string().min(1),
  instrumentClass: z.enum(['BEE_CCTS_ICC', 'VOLUNTARY_CARBON_CREDIT', 'MOEFCC_GREEN_CREDIT']),
  registryName: z.string().trim().min(2).max(80),
  projectId: z.string().trim().min(1).max(120),
  serialRange: z.string().trim().min(1).max(200),
  vintageYear: z.number().int().min(2000).max(2100),
  quantity: z.number().positive().max(1e9),
  status: z.enum(['ISSUED', 'PROCURED']).default('PROCURED'),
  canopyDensityPct: z.number().min(0).max(100).optional(),
  restorationYears: z.number().int().min(0).max(200).optional(),
  restorationParcelId: z.string().trim().max(120).optional()
});
const creditStatusSchema = z.object({
  status: z.enum(['PROCURED', 'PENDING_RETIREMENT', 'RETIRED', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY']),
  transferredToEntityId: z.string().optional()
});
const pcfRequestSchema = z.object({ productDescription: z.string().trim().min(3).max(300) });
const pcfReviewSchema = z.object({ decision: z.enum(['ACCEPTED', 'REJECTED']), reviewNote: z.string().trim().min(5).max(1000).optional() });
const scope3Schema = z.object({
  periodId: z.string().min(1),
  supplierId: z.string().min(1).optional(),
  scope3Category: z.number().int().min(1).max(15),
  method: z.enum(['SUPPLIER_PCF', 'HYBRID', 'AVERAGE_DATA', 'SPEND_BASED']),
  description: z.string().trim().min(3).max(300),
  quantity: z.number().finite().min(0).max(1e12),
  unit: z.string().trim().min(1).max(30),
  spendInr: z.number().finite().min(0).max(1e13).optional(),
  factorId: z.string().min(1)
});
const scope3ReviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reviewNote: z.string().trim().min(5).max(1000).optional() });
const financialsSchema = z.object({
  financialYear: z.string().regex(/^FY\d{4}-\d{2}$/, 'Use the format FY2025-26'),
  revenueInr: z.number().positive().max(1e15),
  imfPppFactor: z.number().positive().max(1000),
  pppReferenceYear: z.number().int().min(2000).max(2100),
  consolidatedOutputValue: z.number().positive().optional(),
  consolidatedOutputUnit: z.string().trim().min(1).max(30).optional(),
  valueChainCoveragePct: z.number().min(0).max(100).optional()
});
const scope2InstrumentSchema = z.object({
  facilityId: z.string().min(1),
  instrumentType: z.enum(['I_REC', 'REC', 'GEOA_PPA', 'GREEN_TARIFF']),
  providerName: z.string().trim().min(2).max(200),
  certificateRef: z.string().trim().min(3).max(120),
  validFrom: utcDate,
  validTo: utcDate,
  totalMwh: z.number().positive().max(10_000_000),
  factorKgCo2ePerKwh: z.number().min(0).max(2),
  retirementRef: z.string().trim().max(200).optional(),
  evidenceFileId: z.string().optional(),
  criteria: z.object({
    conveysAttributes: z.boolean(),
    uniqueClaim: z.boolean(),
    retired: z.boolean(),
    sameMarket: z.boolean()
  })
});
const allocateSchema = z.object({ periodId: z.string().min(1), allocatedMwh: z.number().positive().max(10_000_000) });

@ApiTags('Value Chain, Financials PPP, Scope 2 & Green Economy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller()
export class ValueChainController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('value-chain')
  valueChain(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [suppliers, purchases] = await Promise.all([
        tx.supplier.findMany({ take: LEGACY_CAP, where: { organizationId: orgId }, include: { requests: { orderBy: { createdAt: 'desc' } }, approvedFactor: true }, orderBy: { name: 'asc' } }),
        tx.scope3Purchase.findMany({ take: LEGACY_CAP, where: { organizationId: orgId }, include: { supplier: true, factor: true, period: true }, orderBy: { createdAt: 'desc' } })
      ]);
      return { suppliers, purchases };
    });
  }

  @Post('suppliers')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  createSupplier(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(supplierSchema)) input: z.infer<typeof supplierSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const dup = await tx.supplier.findFirst({ where: { organizationId: orgId, name: { equals: input.name, mode: 'insensitive' } } });
      if (dup) throw new ConflictException(`A supplier named "${dup.name}" already exists.`);
      const created = await tx.supplier.create({ data: { organizationId: orgId, ...input, tradeSharePct: input.tradeSharePct ?? null } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SUPPLIER_CREATED', resourceType: 'Supplier', resourceId: created.id });
      return created;
    });
  }

  @Post('suppliers/:id/pcf-requests')
  @Roles('SUSTAINABILITY_LEAD')
  async createPcfRequest(@CurrentUser() user: AuthUser, @Param('id') supplierId: string, @Body(new ZodValidationPipe(pcfRequestSchema)) body: z.infer<typeof pcfRequestSchema>) {
    const orgId = user.organizationId!;
    const rawToken = crypto.randomBytes(24).toString('hex');
    const request = await this.prisma.withTenantTx(orgId, async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, organizationId: orgId } });
      if (!supplier) throw new NotFoundException('Supplier not found.');
      // One live request per supplier and product: older unanswered links stop working.
      await tx.supplierPcfRequest.updateMany({ where: { supplierId, productDescription: body.productDescription, status: { in: ['SENT', 'OTP_VERIFIED'] } }, data: { status: 'REVOKED' } });
      const row = await tx.supplierPcfRequest.create({
        data: {
          organizationId: orgId,
          supplierId,
          productDescription: body.productDescription,
          tokenHash: sha256(rawToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          requestedById: user.userId
        }
      });
      await tx.emailOutbox.create({
        data: {
          organizationId: orgId,
          toEmail: supplier.contactEmail,
          subject: `PCF Request: ${body.productDescription}`,
          bodyText: `Please submit your Product Carbon Footprint here:\n${appLink('/supplier/' + rawToken)}\n\nYou will be asked for a one-time code sent to this email address.`,
          category: 'SUPPLIER_PCF_REQUEST',
          status: 'PENDING'
        }
      });
      return row;
    });
    return { request, portalPath: `/supplier/${rawToken}`, rawToken };
  }

  @Patch('supplier-requests/:id/review')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  reviewPcf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(pcfReviewSchema)) body: z.infer<typeof pcfReviewSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const reqRow = await tx.supplierPcfRequest.findFirst({ where: { id, organizationId: orgId }, include: { supplier: true } });
      if (!reqRow) throw new NotFoundException('Request not found.');
      if (reqRow.status !== 'SUBMITTED') throw new ConflictException(`This request is ${reqRow.status.toLowerCase().replace('_', ' ')}; only a submitted value can be reviewed.`);
      if (body.decision === 'REJECTED' && !body.reviewNote) throw new BadRequestException('Tell the supplier why the value was rejected (at least 5 characters).');
      if (body.decision === 'ACCEPTED' && (reqRow.submittedFactorVal == null || !reqRow.submittedUnit)) throw new BadRequestException('The supplier has not submitted a value and unit.');
      // Suppliers write units like "kgCO2e/kg" or "tCO2e/t": the part before "/" is the emission mass, after it is the product unit.
      const um = /^\s*(kgco2e|kgco2|tco2e|tco2)\s*\/\s*(.+?)\s*$/i.exec(reqRow.submittedUnit ?? '');
      const perUnit = um ? um[2] : (reqRow.submittedUnit ?? '');
      const toKg = um && /^t/i.test(um[1]) ? 1000 : 1;
      try { lookupUnit(perUnit); } catch { throw new BadRequestException(`The supplier's unit "${reqRow.submittedUnit}" is not recognised. Reject it and ask for a value per kg, tonne, litre, kWh, etc.`); }
      const claimed = await tx.supplierPcfRequest.updateMany({ where: { id, status: 'SUBMITTED' }, data: { status: body.decision, reviewedById: user.userId, reviewNote: body.reviewNote ?? null } });
      if (claimed.count === 0) throw new ConflictException('Someone else reviewed this request first.');
      if (body.decision === 'ACCEPTED') {
        // A supplier's declared value applies from the start of the oldest period still open, so work in progress can use it.
        const oldestOpen = await tx.reportingPeriod.findFirst({ where: { organizationId: orgId, status: { in: ['OPEN', 'REOPENED'] } }, orderBy: { startDate: 'asc' }, select: { startDate: true } });
        const today = new Date(); const from = oldestOpen?.startDate ?? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        const to = new Date(Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), from.getUTCDate()));
        const factor = await tx.emissionFactor.create({
          data: {
            organizationId: orgId,
            code: `PCF-${reqRow.supplier.name.replace(/[^A-Z0-9]/gi, '').slice(0, 10).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            name: `${reqRow.supplier.name} — ${reqRow.productDescription}`,
            domain: 'RAW_MATERIAL',
            scope: 'SCOPE_3',
            scope3Category: 1,
            tier: 'SUPPLIER_PCF',
            status: 'APPROVED',
            regimeTag: 'BRSR_GHG_PROTOCOL',
            region: 'IN',
            sourceAuthority: `${reqRow.supplier.name} (supplier-declared PCF)`,
            versionLabel: 'PCF-v1',
            validFrom: from,
            validTo: to, // supplier values go stale: re-request every year
            canonicalUnit: perUnit,
            co2KgPerUnit: Number(reqRow.submittedFactorVal) * toKg,
            isLocked: true,
            // The value came from the supplier, not from one of our users, so there is no internal author to conflict with the approver.
            createdById: null,
            approvedById: user.userId,
            approvedAt: new Date()
          }
        });
        await tx.supplier.update({ where: { id: reqRow.supplierId }, data: { approvedFactorId: factor.id } });
      }
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: body.decision === 'ACCEPTED' ? 'SUPPLIER_PCF_ACCEPTED' : 'SUPPLIER_PCF_REJECTED', resourceType: 'SupplierPcfRequest', resourceId: id });
      return tx.supplierPcfRequest.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('scope3-purchases')
  @Roles('FINANCE_MANAGER', 'SUSTAINABILITY_LEAD')
  createScope3(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(scope3Schema)) input: z.infer<typeof scope3Schema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const period = await tx.reportingPeriod.findFirst({ where: { id: input.periodId, organizationId: orgId } });
      if (!period) throw new NotFoundException('Reporting period not found.');
      if (!['OPEN', 'REOPENED'].includes(period.status)) throw new ConflictException(`${period.label} is ${period.status.toLowerCase().replace('_', ' ')}.`);
      const factor = await tx.emissionFactor.findFirst({ where: { id: input.factorId } });
      if (!factor) throw new BadRequestException('Emission factor not found.');
      if (!['PUBLISHED', 'APPROVED'].includes(factor.status)) throw new BadRequestException(`Factor ${factor.code} is ${factor.status.toLowerCase()} and cannot be used.`);
      if (factor.regimeTag === 'BEE_CCTS') throw new BadRequestException('Factors tagged for the BEE CCTS regime are for compliance filings only.');
      if (factor.validFrom > period.endDate || (factor.validTo && factor.validTo < period.startDate)) throw new BadRequestException(`Factor ${factor.code} is not valid for ${period.label}.`);
      if (input.supplierId && !(await tx.supplier.findFirst({ where: { id: input.supplierId, organizationId: orgId } }))) throw new BadRequestException('Supplier not found in your organization.');
      if (input.method === 'SPEND_BASED' && !(input.spendInr && input.spendInr > 0)) throw new BadRequestException('Spend-based entries need the amount spent (INR).');
      if (input.method === 'SUPPLIER_PCF' && !input.supplierId) throw new BadRequestException('Supplier-PCF entries must name the supplier whose value you use.');
      let qty: number;
      try { qty = convertToCanonical(input.quantity, input.unit, factor.canonicalUnit, { densityKgPerLitre: factor.densityKgPerLitre ? Number(factor.densityKgPerLitre) : undefined, ncvMjPerCanonical: factor.ncvMjPerUnit ? Number(factor.ncvMjPerUnit) : undefined }).quantity; }
      catch (e: any) { throw new BadRequestException(e?.message ?? `Unit "${input.unit}" cannot be converted to ${factor.canonicalUnit}.`); }
      const gwp = await tx.gwpTable.findMany({ where: { gasCode: { in: [factor.isBiogenic ? 'CH4_NON_FOSSIL' : 'CH4_FOSSIL', 'N2O'] } } });
      const g = (prefix: string) => Number(gwp.find((x) => x.gasCode.startsWith(prefix))?.gwpAr6 ?? NaN);
      // Only look the GWP up when the factor actually carries that gas, so a CO2e-only supplier value never needs it.
      const ch4 = Number(factor.ch4KgPerUnit ?? 0), n2o = Number(factor.n2oKgPerUnit ?? 0);
      const perUnit = Number(factor.co2KgPerUnit) + (ch4 ? ch4 * g('CH4') : 0) + (n2o ? n2o * g('N2O') : 0);
      if (!Number.isFinite(perUnit)) throw new BadRequestException('The GWP table is missing CH4/N2O. Ask the platform administrator to load it.');
      const calc = Number(((qty * perUnit) / 1000).toFixed(6));
      const created = await tx.scope3Purchase.create({
        data: {
          organizationId: orgId, periodId: period.id, supplierId: input.supplierId ?? null, scope3Category: input.scope3Category, method: input.method,
          description: input.description, quantity: input.quantity, unit: input.unit, spendInr: input.spendInr ?? null, factorId: factor.id,
          calculatedTco2eAr6: calc, dataQualityTier: input.method === 'SUPPLIER_PCF' ? 1 : input.method === 'HYBRID' ? 2 : 3, status: 'DRAFT', enteredById: user.userId
        }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE3_PURCHASE_CREATED', resourceType: 'Scope3Purchase', resourceId: created.id, metadata: { tco2e: calc } });
      return created;
    });
  }

  @Post('scope3-purchases/:id/submit')
  @Roles('FINANCE_MANAGER', 'SUSTAINABILITY_LEAD')
  submitScope3(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.scope3Purchase.updateMany({ where: { id, organizationId: orgId, status: { in: ['DRAFT', 'REJECTED'] }, period: { status: { in: ['OPEN', 'REOPENED'] } } }, data: { status: 'SUBMITTED', reviewNote: null, reviewedById: null, reviewedAt: null } });
      if (r.count === 0) throw new ConflictException('Only a draft or rejected purchase in an open period can be submitted.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE3_PURCHASE_SUBMITTED', resourceType: 'Scope3Purchase', resourceId: id });
      return tx.scope3Purchase.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('scope3-purchases/:id/review')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  reviewScope3(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(scope3ReviewSchema)) body: z.infer<typeof scope3ReviewSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const p = await tx.scope3Purchase.findFirst({ where: { id, organizationId: orgId }, include: { period: true } });
      if (!p) throw new NotFoundException('Purchase not found.');
      if (p.status !== 'SUBMITTED') throw new ConflictException('Only a submitted purchase can be reviewed.');
      if (!['OPEN', 'REOPENED'].includes(p.period.status)) throw new ConflictException('The period is closed.');
      if (p.enteredById === user.userId) throw new ForbiddenException('You entered this purchase, so someone else must review it.');
      if (body.decision === 'REJECTED' && !body.reviewNote) throw new BadRequestException('Say what must be corrected (at least 5 characters).');
      await tx.scope3Purchase.update({ where: { id }, data: { status: body.decision, reviewedById: user.userId, reviewedAt: new Date(), reviewNote: body.reviewNote ?? null } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: body.decision === 'APPROVED' ? 'SCOPE3_PURCHASE_APPROVED' : 'SCOPE3_PURCHASE_REJECTED', resourceType: 'Scope3Purchase', resourceId: id });
      return tx.scope3Purchase.findUniqueOrThrow({ where: { id } });
    });
  }

  @Delete('scope3-purchases/:id')
  @Roles('FINANCE_MANAGER', 'SUSTAINABILITY_LEAD')
  deleteScope3(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const r = await tx.scope3Purchase.deleteMany({ where: { id, organizationId: orgId, status: { in: ['DRAFT', 'REJECTED'] }, period: { status: { in: ['OPEN', 'REOPENED'] } } } });
      if (r.count === 0) throw new ConflictException('Only a draft or rejected purchase in an open period can be deleted.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE3_PURCHASE_DELETED', resourceType: 'Scope3Purchase', resourceId: id });
      return { deleted: true };
    });
  }

  @Get('financial-metrics')
  financials(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.financialYearMetrics.findMany({ take: LEGACY_CAP, where: { organizationId: user.organizationId! }, orderBy: { financialYear: 'desc' } })
    );
  }

  @Post('financial-metrics')
  @Roles('FINANCE_MANAGER', 'EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD')
  upsertFinancials(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(financialsSchema)) input: z.infer<typeof financialsSchema>) {
    const orgId = user.organizationId!;
    // BRSR Core intensity uses PPP-adjusted revenue. The PPP factor and its reference year are the company's declared inputs
    // (World Bank / IMF series differ by ICP round), so they are required, never defaulted.
    const pppUsd = Number((input.revenueInr / input.imfPppFactor).toFixed(2));
    const data = { revenueInr: input.revenueInr, imfPppFactor: input.imfPppFactor, pppReferenceYear: input.pppReferenceYear, pppAdjustedRevenueUsd: pppUsd, consolidatedOutputValue: input.consolidatedOutputValue ?? null, consolidatedOutputUnit: input.consolidatedOutputUnit ?? null, valueChainCoveragePct: input.valueChainCoveragePct ?? null, certifiedById: user.userId, certifiedAt: new Date() };
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const row = await tx.financialYearMetrics.upsert({
        where: { organizationId_financialYear: { organizationId: orgId, financialYear: input.financialYear } },
        create: { organizationId: orgId, financialYear: input.financialYear, ...data },
        update: data
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'FINANCIAL_METRICS_CERTIFIED', resourceType: 'FinancialYearMetrics', resourceId: row.id, metadata: { financialYear: input.financialYear, revenueInr: input.revenueInr, ppp: input.imfPppFactor } });
      return row;
    });
  }

  @Get('scope2-instruments')
  scope2(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const where: any = { organizationId: user.organizationId!, ...(q.facilityId ? { facilityId: q.facilityId } : {}), ...(q.instrumentType ? { instrumentType: q.instrumentType } : {}) };
    const include = { facility: { select: { name: true } }, allocations: { include: { period: { select: { label: true } } } } };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paged) return tx.scope2Instrument.findMany({ take: LEGACY_CAP, where, include, orderBy: { validFrom: 'desc' } });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([tx.scope2Instrument.findMany({ where, include, orderBy: [{ validFrom: 'desc' }, { id: 'asc' }], skip: paging.skip, take: paging.take }), tx.scope2Instrument.count({ where })]);
      return pageResult(paging, items, total);
    });
  }

  @Post('scope2-instruments')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  createScope2(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(scope2InstrumentSchema)) input: z.infer<typeof scope2InstrumentSchema>) {
    const orgId = user.organizationId!;
    if (input.validTo <= input.validFrom) throw new BadRequestException('The validity end date must be after the start date.');
    if (input.criteria.retired && !input.retirementRef) throw new BadRequestException('Give the registry retirement reference: an instrument must be retired in the name of your company to be claimed.');
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const facility = await tx.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } });
      if (!facility) throw new BadRequestException('Facility not found in your organization.');
      if (!assertFacilityScope(user, facility.id)) throw new ForbiddenException('You are not assigned to that facility.');
      if (input.evidenceFileId && !(await tx.evidenceFile.findFirst({ where: { id: input.evidenceFileId, organizationId: orgId } }))) throw new BadRequestException('Evidence file not found.');
      // GHG Protocol Scope 2 Guidance, Quality Criteria 1-5 apply to every instrument; the instrument only counts
      // toward market-based Scope 2 when each is satisfied. Vintage (criterion 4) is tested per period at allocation time.
      const c = input.criteria;
      const passes = c.conveysAttributes && c.uniqueClaim && c.retired && c.sameMarket;
      try {
        const created = await tx.scope2Instrument.create({
          data: {
            organizationId: orgId,
            facilityId: facility.id,
            instrumentType: input.instrumentType,
            providerName: input.providerName,
            certificateRef: input.certificateRef,
            validFrom: input.validFrom,
            validTo: input.validTo,
            totalMwh: input.totalMwh,
            remainingMwh: input.totalMwh,
            factorKgCo2ePerKwh: input.factorKgCo2ePerKwh,
            qualityCriteria: { ...c, retirementRef: input.retirementRef ?? null },
            passesAllChecks: passes,
            evidenceFileId: input.evidenceFileId ?? null
          }
        });
        await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE2_INSTRUMENT_CREATED', resourceType: 'Scope2Instrument', resourceId: created.id, metadata: { type: input.instrumentType, mwh: input.totalMwh, passesAllChecks: passes } });
        return created;
      } catch (e: any) {
        if (e?.code === 'P2002') throw new ConflictException('An instrument with this certificate reference is already recorded. A certificate can be claimed only once.');
        throw e;
      }
    });
  }

  @Post('scope2-instruments/:id/allocate')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  allocateScope2(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(allocateSchema)) input: z.infer<typeof allocateSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const inst = await tx.scope2Instrument.findFirst({ where: { id, organizationId: orgId } });
      if (!inst) throw new NotFoundException('Instrument not found.');
      if (!assertFacilityScope(user, inst.facilityId)) throw new ForbiddenException('You are not assigned to that facility.');
      if (!inst.passesAllChecks) throw new BadRequestException('This instrument does not meet the GHG Protocol Scope 2 quality criteria, so it cannot reduce market-based emissions.');
      const period = await tx.reportingPeriod.findFirst({ where: { id: input.periodId, organizationId: orgId } });
      if (!period) throw new NotFoundException('Reporting period not found.');
      if (!['OPEN', 'REOPENED'].includes(period.status)) throw new ConflictException(`${period.label} is ${period.status.toLowerCase().replace('_', ' ')}. Allocate only to an open period.`);
      if (period.startDate < inst.validFrom || period.endDate > inst.validTo) throw new BadRequestException(`This instrument is valid ${inst.validFrom.toISOString().slice(0, 10)} to ${inst.validTo.toISOString().slice(0, 10)}, which does not cover ${period.label}. Vintage must match the consumption period.`);
      // Cannot claim more electricity than the facility used in the period.
      const used = await tx.resourceEntry.findMany({ where: { periodId: period.id, source: { facilityId: inst.facilityId, scope: 'SCOPE_2' }, normalizedUnit: { in: ['kWh', 'kwh'] }, status: { not: 'REJECTED' } }, select: { normalizedQuantity: true } });
      const consumedMwh = used.reduce((a, e) => a + Number(e.normalizedQuantity), 0) / 1000;
      const already = await tx.scope2Allocation.findMany({ where: { periodId: period.id, isReversed: false, instrument: { facilityId: inst.facilityId } }, select: { allocatedMwh: true } });
      const alreadyMwh = already.reduce((a, x) => a + Number(x.allocatedMwh), 0);
      if (consumedMwh > 0 && alreadyMwh + input.allocatedMwh > consumedMwh + 1e-9) throw new BadRequestException(`That facility used ${consumedMwh.toFixed(3)} MWh in ${period.label} and ${alreadyMwh.toFixed(3)} MWh is already covered. You cannot cover more than was consumed.`);
      const dec = await tx.scope2Instrument.updateMany({ where: { id, remainingMwh: { gte: input.allocatedMwh } }, data: { remainingMwh: { decrement: input.allocatedMwh } } });
      if (dec.count === 0) throw new BadRequestException(`Insufficient remaining MWh (${inst.remainingMwh} available).`);
      const alloc = await tx.scope2Allocation.create({ data: { organizationId: orgId, instrumentId: id, periodId: period.id, allocatedMwh: input.allocatedMwh } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE2_ALLOCATED', resourceType: 'Scope2Allocation', resourceId: alloc.id, metadata: { instrumentId: id, periodId: period.id, mwh: input.allocatedMwh } });
      return alloc;
    });
  }

  @Delete('scope2-allocations/:id')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  releaseScope2(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const a = await tx.scope2Allocation.findFirst({ where: { id, organizationId: orgId, isReversed: false }, include: { period: true, instrument: true } });
      if (!a) throw new NotFoundException('Allocation not found.');
      if (!assertFacilityScope(user, a.instrument.facilityId)) throw new ForbiddenException('You are not assigned to that facility.');
      if (!['OPEN', 'REOPENED'].includes(a.period.status)) throw new ConflictException('The period is closed. Reopen it through the audited workflow first.');
      await tx.scope2Allocation.update({ where: { id }, data: { isReversed: true } });
      await tx.scope2Instrument.update({ where: { id: a.instrumentId }, data: { remainingMwh: { increment: a.allocatedMwh } } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'SCOPE2_ALLOCATION_RELEASED', resourceType: 'Scope2Allocation', resourceId: id, metadata: { instrumentId: a.instrumentId, mwh: Number(a.allocatedMwh) } });
      return { released: true };
    });
  }

  @Get('green-economy')
  greenEconomy(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const [credits, cctsTargets] = await Promise.all([
        tx.greenEconomyCredit.findMany({ take: LEGACY_CAP, where: { organizationId: orgId }, include: { entity: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
        tx.cctsComplianceTarget.findMany({ take: LEGACY_CAP, where: { organizationId: orgId }, include: { facility: { select: { name: true } } }, orderBy: { financialYear: 'desc' } })
      ]);
      return { credits, cctsTargets };
    });
  }

  @Post('green-economy/credits')
  @Roles('SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'EXECUTIVE_APPROVER')
  createCredit(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(creditSchema)) input: z.infer<typeof creditSchema>) {
    const orgId = user.organizationId!;
    if (input.instrumentClass === 'MOEFCC_GREEN_CREDIT') {
      if (input.canopyDensityPct == null || input.canopyDensityPct < 40) throw new BadRequestException('A MoEFCC Green Credit needs canopy density of at least 40%.');
      if (input.restorationYears == null || input.restorationYears < 5) throw new BadRequestException('A MoEFCC Green Credit needs at least 5 years of restoration.');
    }
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const entity = await tx.entity.findFirst({ where: { id: input.entityId, organizationId: orgId } });
      if (!entity) throw new BadRequestException('The holding entity is not in your organization.');
      try {
        const created = await tx.greenEconomyCredit.create({
          data: { organizationId: orgId, ...input, createdById: user.userId }
        });
        await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'GREEN_CREDIT_REGISTERED', resourceType: 'GreenEconomyCredit', resourceId: created.id, metadata: { registry: input.registryName, serial: input.serialRange, quantity: input.quantity } });
        return created;
      } catch (e: any) {
        if (e?.code === 'P2002') throw new ConflictException('This serial range is already recorded for that registry. A credit can be held only once.');
        throw e;
      }
    });
  }

  @Patch('green-economy/credits/:id/status')
  @Roles('EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD')
  updateCreditStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(creditStatusSchema)) input: z.infer<typeof creditStatusSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const c = await tx.greenEconomyCredit.findFirst({ where: { id, organizationId: orgId } });
      if (!c) throw new NotFoundException('Credit not found.');
      const allowed: Record<string, string[]> = {
        ISSUED: ['PROCURED', 'PENDING_RETIREMENT', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY'],
        PROCURED: ['PENDING_RETIREMENT', 'EXTINGUISHED'],
        PENDING_RETIREMENT: ['RETIRED', 'PROCURED'],
        RETIRED: [], EXTINGUISHED: [], TRANSFERRED_SUBSIDIARY: []
      };
      if (!allowed[c.status].includes(input.status)) throw new ConflictException(`A credit that is ${c.status.toLowerCase().replace('_', ' ')} cannot become ${input.status.toLowerCase().replace('_', ' ')}.${allowed[c.status].length === 0 ? ' This status is final.' : ''}`);
      // Retiring or extinguishing cannot be undone in the registry, so the approver must be an Executive Approver who did not register the credit.
      if (['RETIRED', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY'].includes(input.status)) {
        if (!user.roles.includes('EXECUTIVE_APPROVER')) throw new ForbiddenException('Only an Executive Approver can finalise a credit.');
        if (c.createdById === user.userId) throw new ForbiddenException('You registered this credit, so someone else must finalise it.');
      }
      let transferTo: string | null = null;
      if (input.status === 'TRANSFERRED_SUBSIDIARY') {
        if (c.instrumentClass !== 'MOEFCC_GREEN_CREDIT') throw new BadRequestException('Only MoEFCC Green Credits can be transferred to a subsidiary.');
        if (!input.transferredToEntityId || input.transferredToEntityId === c.entityId) throw new BadRequestException('Choose a different entity to receive the credit.');
        if (!(await tx.entity.findFirst({ where: { id: input.transferredToEntityId, organizationId: orgId } }))) throw new BadRequestException('The receiving entity is not in your organization.');
        transferTo = input.transferredToEntityId;
      }
      const approving = ['RETIRED', 'EXTINGUISHED', 'TRANSFERRED_SUBSIDIARY'].includes(input.status);
      const r = await tx.greenEconomyCredit.updateMany({ where: { id, status: c.status }, data: { status: input.status, transferredToEntityId: transferTo, ...(approving ? { approvedById: user.userId, approvedAt: new Date() } : {}) } });
      if (r.count === 0) throw new ConflictException('The credit changed while you were working. Reload and try again.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'GREEN_CREDIT_STATUS_CHANGED', resourceType: 'GreenEconomyCredit', resourceId: id, metadata: { from: c.status, to: input.status } });
      return tx.greenEconomyCredit.findUniqueOrThrow({ where: { id } });
    });
  }
}
