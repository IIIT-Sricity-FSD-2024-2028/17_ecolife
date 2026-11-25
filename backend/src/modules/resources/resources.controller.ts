import { LEGACY_CAP } from '../../common/utils/paging.util';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard, assertFacilityScope, facilityScope } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { writeAuditLog } from '../../common/utils/audit.util';
import { lookupUnit } from '../../common/utils/units';
import { fyStartYearFor } from '../../common/utils/fiscal.util';
import { WasteCategory, WasteRoute, WaterDestination, WaterSource } from '../../generated/prisma';
import { pageResult, parsePaging } from '../../common/utils/paging.util';

type Tx = any;
const FY = z.string().regex(/^FY\d{4}-\d{2}$/, 'Use the format FY2025-26');
const fyStart = (fy: string) => Number(fy.slice(2, 6));
const fyName = (start: number) => `FY${start}-${String((start + 1) % 100).padStart(2, '0')}`;
import { TREATMENT_LEVELS, HAZARDOUS_WASTE } from '../../common/utils/waste.constants';
const HAZARDOUS = HAZARDOUS_WASTE;

// ---------------------------------------------------------------------------------------------------------
// Operational logs (water, waste, air, materials, outputs): one draft -> submit -> review workflow for all five.
// ---------------------------------------------------------------------------------------------------------
const base = { facilityId: z.string().min(1), periodId: z.string().min(1) };

const waterSchema = z.object({
  ...base,
  withdrawalSource: z.enum(WaterSource),
  withdrawalKl: z.number().finite().nonnegative().max(1e9),
  dischargeKl: z.number().finite().nonnegative().max(1e9).default(0),
  dischargeDestination: z.enum(WaterDestination).optional(),
  treatmentLevel: z.enum(TREATMENT_LEVELS).optional(),
  recycledKl: z.number().finite().nonnegative().max(1e9).default(0),
  costInr: z.number().finite().nonnegative().optional()
});
const wasteSchema = z.object({
  ...base,
  wasteCategory: z.enum(WasteCategory),
  treatmentRoute: z.enum(WasteRoute),
  quantityMt: z.number().finite().positive().max(1e7),
  isOnsite: z.boolean().default(false),
  manifestRef: z.string().trim().min(3).max(120).optional(),
  costInr: z.number().finite().nonnegative().optional()
});
const airSchema = z.object({
  ...base,
  stackId: z.string().trim().min(1).max(60),
  pollutant: z.enum(['NOX', 'SOX', 'PM', 'PM10', 'PM2_5', 'VOC', 'POP', 'HAP']),
  quantityKg: z.number().finite().nonnegative().max(1e9),
  spcbLimitKg: z.number().finite().positive().max(1e9).optional(),
  spcbLimitNote: z.string().trim().max(500).optional()
});
const materialSchema = z.object({
  ...base,
  materialName: z.string().trim().min(2).max(160),
  isPackagingEpr: z.boolean().default(false),
  origin: z.enum(['VIRGIN', 'RECYCLED', 'REUSED']),
  quantityMt: z.number().finite().positive().max(1e7),
  linkedScope3Tco2e: z.number().finite().nonnegative().default(0)
});
const outputSchema = z.object({
  ...base,
  productName: z.string().trim().min(2).max(160),
  outputValue: z.number().finite().positive().max(1e12),
  outputUnit: z.string().trim().min(1).max(40)
});

type Kind = { delegate: string; schema: z.ZodObject<any>; label: string; dupKey: (i: any) => Record<string, unknown>; roles: string[]; extra?: (tx: Tx, input: any, ctx: { facility: any; period: any }) => Promise<void> };
const KINDS: Record<string, Kind> = {
  water: {
    delegate: 'waterLog', schema: waterSchema, label: 'Water record', roles: ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD'],
    dupKey: (i) => ({ withdrawalSource: i.withdrawalSource }),
    extra: async (_tx, i) => {
      if (i.dischargeKl > i.withdrawalKl) throw new BadRequestException('Water balance error: discharge cannot be more than withdrawal. If you reuse treated water, enter it as recycled.');
      if (i.dischargeKl > 0 && !i.dischargeDestination) throw new BadRequestException('Say where the discharged water goes (BRSR asks for the destination and treatment level).');
      if (i.dischargeKl > 0 && i.dischargeDestination !== 'ZLD_RECYCLED' && !i.treatmentLevel) throw new BadRequestException('Say the level of treatment before discharge.');
    }
  },
  waste: {
    delegate: 'wasteLog', schema: wasteSchema, label: 'Waste record', roles: ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD'],
    dupKey: (i) => ({ wasteCategory: i.wasteCategory, treatmentRoute: i.treatmentRoute, isOnsite: i.isOnsite }),
    extra: async (_tx, i) => {
      // Hazardous and other waste moving off site travels on a manifest (Form 10 of the Hazardous and Other Wastes Rules, 2016); e-waste, battery and bio-medical rules have their own tracking.
      if (HAZARDOUS.includes(i.wasteCategory) && !i.isOnsite && !i.manifestRef) throw new BadRequestException('Hazardous waste leaving the site needs its manifest or tracking number.');
    }
  },
  'air-emissions': {
    delegate: 'airEmissionLog', schema: airSchema, label: 'Air emission record', roles: ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD'],
    dupKey: (i) => ({ stackId: i.stackId, pollutant: i.pollutant }),
    extra: async (_tx, i) => {
      if (i.spcbLimitKg != null && i.quantityKg > i.spcbLimitKg && !(i.spcbLimitNote && i.spcbLimitNote.length >= 10)) {
        throw new BadRequestException(`Emission (${i.quantityKg} kg) is above the permitted ${i.spcbLimitKg} kg. Record the cause and the corrective action in the note (at least 10 characters).`);
      }
    }
  },
  materials: {
    delegate: 'materialLog', schema: materialSchema, label: 'Material record', roles: ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD'],
    dupKey: (i) => ({ materialName: i.materialName, origin: i.origin })
  },
  outputs: {
    delegate: 'facilityOutputLog', schema: outputSchema, label: 'Output record', roles: ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER'],
    dupKey: (i) => ({ productName: i.productName, outputUnit: i.outputUnit })
  }
};
const KIND_PATH: Record<string, string> = { water: 'water', waste: 'waste', 'air-emissions': 'air-emissions', materials: 'materials', outputs: 'outputs' };

const refrigSchema = z.object({
  facilityId: z.string().min(1),
  equipmentName: z.string().trim().min(2).max(160),
  refrigerantCode: z.string().trim().min(2).max(40),
  nameplateKg: z.number().finite().positive().max(1e6),
  defaultLeakPct: z.number().min(0).max(100).optional()
});

const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reviewNote: z.string().trim().max(1000).optional() });

// ---------------------------------------------------------------------------------------------------------
// Targets and actions
// ---------------------------------------------------------------------------------------------------------
const targetSchema = z.object({
  name: z.string().trim().min(3).max(180),
  targetType: z.enum(['ABSOLUTE', 'INTENSITY']),
  scopeCoverage: z.enum(['SCOPE_1', 'SCOPE_2_LOCATION', 'SCOPE_2_MARKET', 'SCOPE_1_AND_2_LOCATION', 'SCOPE_1_AND_2_MARKET', 'SCOPE_3', 'ALL_SCOPES_1_2_3']),
  framework: z.enum(['CUSTOM_INTERNAL', 'SBTI_SME_ROUTE', 'SBTI_NEAR_TERM', 'SBTI_NET_ZERO', 'BEE_CCTS_GEI']),
  baseYear: FY,
  targetYear: FY,
  baseValue: z.number().finite().positive().max(1e12),
  intensityUnit: z.string().trim().min(3).max(60).optional(),
  targetReductionPct: z.number().min(0.1).max(100)
});
const actionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  domain: z.enum(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE', 'AIR_EMISSION', 'RAW_MATERIAL', 'LAND_GREENBELT']),
  lever: z.enum(['FUEL_SWITCH', 'ENERGY_EFFICIENCY', 'ONSITE_SOLAR', 'PPA_OPEN_ACCESS', 'REFRIGERANT_SWAP', 'FLEET_ELECTRIFICATION', 'PROCESS_OPTIMIZATION', 'WATER_CIRCULARITY', 'WASTE_DIVERSION', 'SUPPLIER_ENGAGEMENT']),
  facilityId: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
  expectedSavingTco2e: z.number().finite().positive().max(1e9),
  secondaryScopeShiftTco2e: z.number().finite().nonnegative().max(1e9).default(0),
  biogenicShiftTco2e: z.number().finite().nonnegative().max(1e9).default(0),
  capexInr: z.number().finite().nonnegative().max(1e13).default(0),
  annualOpexDeltaInr: z.number().finite().min(-1e13).max(1e13).default(0),
  lifetimeYears: z.number().int().min(1).max(40),
  // MACC practice discounts the cost stream; the company's own hurdle rate is an input, never assumed.
  discountRatePct: z.number().min(0).max(50).default(0),
  endDate: z.coerce.date()
});
const actionUpdateSchema = z.object({
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'PARTIALLY_ACHIEVED', 'CANCELLED']).optional(),
  achievedSavingTco2e: z.number().finite().nonnegative().max(1e9).optional(),
  implementationDate: z.coerce.date().optional(),
  revisedEndDate: z.coerce.date().optional(),
  delayReason: z.string().trim().min(10).max(1000).optional(),
  cancellationReason: z.string().trim().min(10).max(1000).optional()
}).refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.');

const SCOPE_FIELDS: Record<string, (s: any) => number> = {
  SCOPE_1: (s) => Number(s.scope1Ar6Tco2e),
  SCOPE_2_LOCATION: (s) => Number(s.scope2LocationAr6Tco2e),
  SCOPE_2_MARKET: (s) => Number(s.scope2MarketAr6Tco2e),
  SCOPE_1_AND_2_LOCATION: (s) => Number(s.scope1Ar6Tco2e) + Number(s.scope2LocationAr6Tco2e),
  SCOPE_1_AND_2_MARKET: (s) => Number(s.scope1Ar6Tco2e) + Number(s.scope2MarketAr6Tco2e),
  SCOPE_3: (s) => Number(s.scope3Ar6Tco2e),
  ALL_SCOPES_1_2_3: (s) => Number(s.scope1Ar6Tco2e) + Number(s.scope2LocationAr6Tco2e) + Number(s.scope3Ar6Tco2e)
};

/** Real emissions of one financial year from the latest closed snapshot of every month. */
async function fyActual(tx: Tx, orgId: string, fy: string, coverage: string) {
  const periods = await tx.reportingPeriod.findMany({ where: { organizationId: orgId, financialYear: fy }, select: { id: true, status: true } });
  const closed = periods.filter((p: any) => ['CLOSED', 'SIGNED_OFF'].includes(p.status));
  let total = 0;
  for (const p of closed) {
    const snap = await tx.periodSnapshot.findFirst({ where: { periodId: p.id }, orderBy: { version: 'desc' } });
    if (snap) total += SCOPE_FIELDS[coverage](snap);
  }
  return { total, closedMonths: closed.length, months: periods.length, complete: periods.length === 12 && closed.length === 12 };
}

@ApiTags('Resource Domains, Targets & MACC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller()
export class ResourcesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Rows plus the total, filtered the same way, so the screen can page without loading everything. */
  private async listPage(user: AuthUser, delegate: string, q: Record<string, any>, extraInclude: object = {}) {
    const paging = parsePaging(q);
    const scope = facilityScope(user);
    if (q.status && !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'].includes(q.status)) throw new BadRequestException('Unknown status filter.');
    const where = {
      organizationId: user.organizationId!,
      ...(scope ? { facilityId: { in: scope } } : {}),
      ...(q.facilityId ? { facilityId: scope && !scope.includes(q.facilityId) ? '__none__' : q.facilityId } : {}),
      ...(q.periodId ? { periodId: q.periodId } : {}),
      ...(q.status ? { status: q.status } : {})
    };
    return this.prisma.withTenantTx(user.organizationId!, async (tx: Tx) => {
      const [rows, total] = await Promise.all([
        tx[delegate].findMany({
          where,
          include: { facility: { select: { name: true, isWaterStressArea: true, spcbWaterLimitKl: true } }, period: { select: { label: true, startDate: true, endDate: true } }, ...extraInclude },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: paging.skip,
          take: paging.take
        }),
        paging.paged ? tx[delegate].count({ where }) : Promise.resolve(0)
      ]);
      return { paging, rows, total };
    });
  }

  @Get('resources/water')
  async waterList(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const { paging, rows, total } = await this.listPage(user, 'waterLog', q);
    // Consent to Operate limits are in kL per day: an average above the limit is a certain exceedance.
    return pageResult(paging, rows.map((r: any) => {
      const days = Math.round((r.period.endDate.getTime() - r.period.startDate.getTime()) / 86400000) + 1;
      const perDay = Number(r.withdrawalKl) / days;
      const limit = r.facility.spcbWaterLimitKl != null ? Number(r.facility.spcbWaterLimitKl) : null;
      return { ...r, avgDailyWithdrawalKl: Number(perDay.toFixed(3)), spcbLimitKlPerDay: limit, exceedsSpcbLimit: limit != null && perDay > limit, inWaterStressArea: r.facility.isWaterStressArea };
    }), total);
  }
  @Get('resources/waste') async wasteList(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) { const r = await this.listPage(user, 'wasteLog', q); return pageResult(r.paging, r.rows, r.total); }
  @Get('resources/air-emissions')
  async airList(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const { paging, rows, total } = await this.listPage(user, 'airEmissionLog', q);
    return pageResult(paging, rows.map((r: any) => ({ ...r, exceedsLimit: r.spcbLimitKg != null && Number(r.quantityKg) > Number(r.spcbLimitKg) })), total);
  }
  @Get('resources/materials') async materialList(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) { const r = await this.listPage(user, 'materialLog', q); return pageResult(r.paging, r.rows, r.total); }
  @Get('resources/outputs') async outputList(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) { const r = await this.listPage(user, 'facilityOutputLog', q); return pageResult(r.paging, r.rows, r.total); }

  @Get('resources/gwp')
  gwpList(@CurrentUser() user: AuthUser) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) => tx.gwpTable.findMany({ orderBy: { gasCode: 'asc' } }));
  }

  // ---------------------------------------------------------------- refrigerant equipment register
  @Get('resources/refrigerants')
  refrigList(@CurrentUser() user: AuthUser) {
    const scope = facilityScope(user);
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.refrigerantEquipment.findMany({ take: LEGACY_CAP, where: { organizationId: user.organizationId!, ...(scope ? { facilityId: { in: scope } } : {}) }, include: { facility: { select: { name: true } }, refrigerantGas: true } })
    );
  }

  @Post('resources/refrigerants')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD')
  createRefrig(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(refrigSchema)) input: z.infer<typeof refrigSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx) => {
      const facility = await tx.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } });
      if (!facility) throw new BadRequestException('Facility not found in your organization.');
      if (!assertFacilityScope(user, facility.id)) throw new ForbiddenException('You are not assigned to that facility.');
      const gas = await tx.gwpTable.findUnique({ where: { gasCode: input.refrigerantCode } });
      if (!gas || ['CO2', 'N2O', 'CH4_FOSSIL', 'CH4_NON_FOSSIL'].includes(gas.gasCode)) throw new BadRequestException(`${input.refrigerantCode} is not a refrigerant in the GWP table. Pick one from the list.`);
      const dup = await tx.refrigerantEquipment.findFirst({ where: { organizationId: orgId, facilityId: facility.id, equipmentName: { equals: input.equipmentName, mode: 'insensitive' }, isActive: true } });
      if (dup) throw new ConflictException('That equipment is already registered at this facility.');
      const row = await tx.refrigerantEquipment.create({ data: { organizationId: orgId, ...input } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REFRIGERANT_EQUIPMENT_REGISTERED', resourceType: 'RefrigerantEquipment', resourceId: row.id });
      return row;
    });
  }

  /** Shared checks: the facility and period belong to the organization, the user may work there, the period is open and the facility was operating in it. */
  private async context(tx: Tx, orgId: string, user: AuthUser, facilityId: string, periodId: string) {
    const [facility, period] = await Promise.all([
      tx.facility.findFirst({ where: { id: facilityId, organizationId: orgId } }),
      tx.reportingPeriod.findFirst({ where: { id: periodId, organizationId: orgId } })
    ]);
    if (!facility) throw new BadRequestException('Facility not found in your organization.');
    if (!period) throw new BadRequestException('Reporting period not found.');
    if (!assertFacilityScope(user, facility.id)) throw new ForbiddenException('You are not assigned to that facility.');
    if (facility.approvalStatus !== 'APPROVED') throw new BadRequestException(`${facility.name} is awaiting approval, so it cannot report yet.`);
    if (!['OPEN', 'REOPENED'].includes(period.status)) throw new ConflictException(`${period.label} is ${period.status.toLowerCase().replace('_', ' ')}.`);
    if (facility.effectiveFrom > period.endDate || (facility.effectiveTo && facility.effectiveTo < period.startDate)) throw new BadRequestException(`${facility.name} was not in operation in ${period.label}.`);
    return { facility, period };
  }

  private kind(k: string): Kind {
    const kind = KINDS[k];
    if (!kind) throw new NotFoundException('Unknown record type.');
    return kind;
  }

  @Post('resources/:kind')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  create(@CurrentUser() user: AuthUser, @Param('kind') k: string, @Body() body: unknown) {
    const kind = this.kind(k);
    if (!kind.roles.some((r) => user.roles.includes(r as any))) throw new ForbiddenException('Your role cannot record this type of data.');
    const parsed = kind.schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    const input: any = parsed.data;
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const ctx = await this.context(tx, orgId, user, input.facilityId, input.periodId);
      await kind.extra?.(tx, input, ctx);
      const dup = await tx[kind.delegate].findFirst({ where: { organizationId: orgId, facilityId: input.facilityId, periodId: input.periodId, ...kind.dupKey(input), status: { not: 'REJECTED' } } });
      if (dup) throw new ConflictException(`${kind.label} for this facility, period and category already exists. Edit that one instead of adding another.`);
      const data: any = { organizationId: orgId, ...input, status: 'DRAFT', submittedById: user.userId };
      if (k === 'water') data.consumptionKl = Number((input.withdrawalKl - input.dischargeKl).toFixed(4));
      const row = await tx[kind.delegate].create({ data });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `${k.toUpperCase().replace('-', '_')}_LOG_CREATED`, resourceType: kind.delegate, resourceId: row.id });
      return row;
    });
  }

  @Patch('resources/:kind/:id')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  update(@CurrentUser() user: AuthUser, @Param('kind') k: string, @Param('id') id: string, @Body() body: unknown) {
    const kind = this.kind(k);
    const parsed = kind.schema.omit({ facilityId: true, periodId: true }).partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    // Schema defaults must not overwrite stored values: keep only fields the caller actually sent.
    const sent = Object.keys((body ?? {}) as object);
    const changes: any = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => sent.includes(key)));
    if (Object.keys(changes).length === 0) throw new BadRequestException('Send at least one field to change.');
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const cur = await tx[kind.delegate].findFirst({ where: { id, organizationId: orgId } });
      if (!cur) throw new NotFoundException('Record not found.');
      if (!['DRAFT', 'REJECTED'].includes(cur.status)) throw new ConflictException('Only a draft or rejected record can be edited.');
      const merged: any = { ...Object.fromEntries(Object.entries(cur).map(([a, b]: any) => [a, b && typeof b === 'object' && 'toNumber' in b ? Number(b) : b])), ...changes };
      const ctx = await this.context(tx, orgId, user, cur.facilityId, cur.periodId);
      await kind.extra?.(tx, merged, ctx);
      const data: any = { ...changes, status: 'DRAFT', reviewNote: null };
      if (k === 'water') data.consumptionKl = Number((merged.withdrawalKl - merged.dischargeKl).toFixed(4));
      const row = await tx[kind.delegate].update({ where: { id }, data });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `${k.toUpperCase().replace('-', '_')}_LOG_EDITED`, resourceType: kind.delegate, resourceId: id });
      return row;
    });
  }

  @Delete('resources/:kind/:id')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  remove(@CurrentUser() user: AuthUser, @Param('kind') k: string, @Param('id') id: string) {
    const kind = this.kind(k);
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const cur = await tx[kind.delegate].findFirst({ where: { id, organizationId: orgId }, include: { period: true } });
      if (!cur) throw new NotFoundException('Record not found.');
      if (!assertFacilityScope(user, cur.facilityId)) throw new ForbiddenException('You are not assigned to that facility.');
      if (!['DRAFT', 'REJECTED'].includes(cur.status) || !['OPEN', 'REOPENED'].includes(cur.period.status)) throw new ConflictException('Only a draft or rejected record in an open period can be deleted.');
      await tx[kind.delegate].delete({ where: { id } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `${k.toUpperCase().replace('-', '_')}_LOG_DELETED`, resourceType: kind.delegate, resourceId: id });
      return { deleted: true };
    });
  }

  @Post('resources/:kind/:id/submit')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  submit(@CurrentUser() user: AuthUser, @Param('kind') k: string, @Param('id') id: string) {
    const kind = this.kind(k);
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const cur = await tx[kind.delegate].findFirst({ where: { id, organizationId: orgId }, include: { period: true } });
      if (!cur) throw new NotFoundException('Record not found.');
      if (!assertFacilityScope(user, cur.facilityId)) throw new ForbiddenException('You are not assigned to that facility.');
      if (!['OPEN', 'REOPENED'].includes(cur.period.status)) throw new ConflictException(`${cur.period.label} is closed.`);
      if (cur.reviewedById && cur.reviewedById === user.userId && !cur.isSelfReviewed && cur.status === 'REJECTED') throw new ConflictException('You sent this record back yourself, so you cannot send it for review again. Ask the person who entered it to correct it and send it.');
      const r = await tx[kind.delegate].updateMany({ where: { id, status: { in: ['DRAFT', 'REJECTED'] } }, data: { status: 'SUBMITTED', submittedById: user.userId, reviewNote: null } });
      if (r.count === 0) throw new ConflictException('Only a draft or rejected record can be submitted.');
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `${k.toUpperCase().replace('-', '_')}_LOG_SUBMITTED`, resourceType: kind.delegate, resourceId: id });
      return tx[kind.delegate].findUniqueOrThrow({ where: { id } });
    });
  }

  @Post('resources/:kind/:id/review')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  review(@CurrentUser() user: AuthUser, @Param('kind') k: string, @Param('id') id: string, @Body(new ZodValidationPipe(reviewSchema)) input: z.infer<typeof reviewSchema>) {
    const kind = this.kind(k);
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const cur = await tx[kind.delegate].findFirst({ where: { id, organizationId: orgId }, include: { period: true } });
      if (!cur) throw new NotFoundException('Record not found.');
      if (cur.status !== 'SUBMITTED') throw new ConflictException(`Only a submitted record can be reviewed (this one is ${cur.status.toLowerCase()}).`);
      if (!['OPEN', 'REOPENED'].includes(cur.period.status)) throw new ConflictException(`${cur.period.label} is closed.`);
      if (input.decision === 'REJECTED' && !(input.reviewNote && input.reviewNote.length >= 5)) throw new BadRequestException('Say what needs fixing when rejecting (at least 5 characters).');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { allowSingleUserMode: true } });
      const isSelfReviewed = cur.submittedById === user.userId;
      if (isSelfReviewed && !org.allowSingleUserMode) throw new ForbiddenException('You submitted this record, so someone else must review it.');
      await tx[kind.delegate].update({ where: { id }, data: { status: input.decision, reviewedById: user.userId, reviewNote: input.reviewNote ?? null, isSelfReviewed } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: `${k.toUpperCase().replace('-', '_')}_LOG_${input.decision}`, resourceType: kind.delegate, resourceId: id, metadata: { isSelfReviewed } });
      return tx[kind.delegate].findUniqueOrThrow({ where: { id } });
    });
  }

  // ---------------------------------------------------------------- targets
  @Get('targets')
  targets(@CurrentUser() user: AuthUser) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const targets = await tx.target.findMany({ take: LEGACY_CAP, where: { organizationId: orgId }, include: { milestones: { orderBy: { financialYear: 'asc' } }, actions: { orderBy: { macInrPerTco2e: 'asc' } } }, orderBy: { createdAt: 'desc' } });
      const out = [];
      for (const t of targets) {
        const progress = [];
        if (t.targetType === 'ABSOLUTE') {
          for (const m of t.milestones) {
            const a = await fyActual(tx, orgId, m.financialYear, t.scopeCoverage);
            progress.push({ financialYear: m.financialYear, plannedValue: Number(m.plannedValue), actualValue: a.closedMonths ? Number(a.total.toFixed(4)) : null, closedMonths: a.closedMonths, complete: a.complete });
          }
        }
        out.push({ ...t, progress });
      }
      return out;
    });
  }

  @Post('targets')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createTarget(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(targetSchema)) input: z.infer<typeof targetSchema>) {
    const orgId = user.organizationId!;
    const b = fyStart(input.baseYear), t = fyStart(input.targetYear);
    if (t <= b) throw new BadRequestException('The target year must be after the base year.');
    if (t - b > 40) throw new BadRequestException('A target more than 40 years out is not credible; choose nearer milestones.');
    if (input.targetType === 'INTENSITY' && !input.intensityUnit) throw new BadRequestException('An intensity target needs its unit, e.g. "tCO2e per tonne of product".');
    if (input.framework === 'SBTI_SME_ROUTE' || input.framework === 'SBTI_NEAR_TERM') {
      if (input.targetType !== 'ABSOLUTE' && ['SCOPE_1', 'SCOPE_2_LOCATION', 'SCOPE_2_MARKET', 'SCOPE_1_AND_2_LOCATION', 'SCOPE_1_AND_2_MARKET'].includes(input.scopeCoverage)) throw new BadRequestException('SBTi requires absolute targets for Scope 1 and 2.');
      // SBTi 1.5C-aligned near-term minimum: 4.2% of base-year emissions per year from the base year to the target year.
      const minPct = Number((4.2 * (t - b)).toFixed(1));
      if (input.targetReductionPct < minPct) throw new BadRequestException(`SBTi needs at least ${minPct}% (4.2% a year over ${t - b} years) for a 1.5°C-aligned near-term target. You entered ${input.targetReductionPct}%.`);
    }
    if (input.framework === 'SBTI_SME_ROUTE' && input.baseValue >= 10000) throw new BadRequestException('The SBTi SME route is for companies with under 10,000 tCO2e of Scope 1 and location-based Scope 2.');
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      // Targets must start from the real inventory when the base year is already closed.
      let baseSource = 'DECLARED';
      if (input.targetType === 'ABSOLUTE') {
        const a = await fyActual(tx, orgId, input.baseYear, input.scopeCoverage);
        if (a.complete) {
          baseSource = 'INVENTORY';
          if (Math.abs(a.total - input.baseValue) / a.total > 0.01) throw new BadRequestException(`Your base value (${input.baseValue}) differs from the closed ${input.baseYear} inventory (${a.total.toFixed(2)} tCO2e) by more than 1%. Use the inventory value.`);
        }
      }
      const targetValue = Number((input.baseValue * (1 - input.targetReductionPct / 100)).toFixed(4));
      const created = await tx.target.create({ data: { organizationId: orgId, ...input, originalBaseValue: input.baseValue, targetValue, status: 'ON_TRACK', ownerId: user.userId } });
      const years = t - b;
      await tx.targetMilestone.createMany({
        data: Array.from({ length: years }, (_, i) => ({
          organizationId: orgId, targetId: created.id, financialYear: fyName(b + i + 1),
          plannedValue: Number((input.baseValue - ((input.baseValue - targetValue) * (i + 1)) / years).toFixed(4)), status: 'ON_TRACK' as const
        }))
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'TARGET_CREATED', resourceType: 'Target', resourceId: created.id, metadata: { framework: input.framework, baseSource, reductionPct: input.targetReductionPct } });
      return { ...created, baseValueSource: baseSource };
    });
  }

  /** Writes the real result of every completed financial year into its milestone and sets the target status. */
  @Post('targets/:id/evaluate')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  evaluateTarget(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const t = await tx.target.findFirst({ where: { id, organizationId: orgId }, include: { milestones: { orderBy: { financialYear: 'asc' } } } });
      if (!t) throw new NotFoundException('Target not found.');
      if (t.targetType !== 'ABSOLUTE') throw new BadRequestException('Automatic evaluation covers absolute targets. Intensity targets need an agreed output measure.');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { significanceThresholdPct: true } });
      const band = Number(org.significanceThresholdPct);
      let status: string = t.status === 'NEEDS_RESTATEMENT' ? 'NEEDS_RESTATEMENT' : 'ON_TRACK';
      let latest: any = null;
      for (const m of t.milestones) {
        const a = await fyActual(tx, orgId, m.financialYear, t.scopeCoverage);
        if (!a.complete) continue; // only a fully closed year can be judged
        const planned = Number(m.plannedValue);
        const variance = Number((((a.total - planned) / planned) * 100).toFixed(2));
        const ms = variance <= 0 ? 'ON_TRACK' : variance <= band ? 'AT_RISK' : 'OFF_TRACK';
        await tx.targetMilestone.update({ where: { id: m.id }, data: { actualValue: Number(a.total.toFixed(4)), variancePct: variance, status: ms, evaluatedAt: new Date() } });
        latest = { financialYear: m.financialYear, actual: a.total, planned, variance, status: ms };
        if (t.status !== 'NEEDS_RESTATEMENT') status = ms;
      }
      if (latest && fyStart(latest.financialYear) >= fyStart(t.targetYear)) status = latest.actual <= Number(t.targetValue) ? 'ACHIEVED' : 'MISSED';
      if (status === 'MISSED' && !t.missedExplanation) status = 'OFF_TRACK'; // MISSED needs a written explanation first
      await tx.target.update({ where: { id }, data: { status } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'TARGET_EVALUATED', resourceType: 'Target', resourceId: id, metadata: { status, latest } });
      return { status, latest };
    });
  }

  @Post('targets/:targetId/actions')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER')
  createAction(@CurrentUser() user: AuthUser, @Param('targetId') targetId: string, @Body(new ZodValidationPipe(actionSchema)) input: z.infer<typeof actionSchema>) {
    const orgId = user.organizationId!;
    const net = input.expectedSavingTco2e - input.secondaryScopeShiftTco2e;
    if (net <= 0) throw new BadRequestException('This action causes as much or more emissions elsewhere (secondary-scope shift) than it saves, so it cannot count as a reduction.');
    const r = input.discountRatePct / 100, n = input.lifetimeYears;
    // Levelised annual cost: capex spread over the life at the discount rate, plus the yearly running-cost change; divided by the yearly net saving.
    const annuity = r === 0 ? 1 / n : r / (1 - Math.pow(1 + r, -n));
    const mac = (input.capexInr * annuity + input.annualOpexDeltaInr) / net;
    const payback = input.annualOpexDeltaInr < 0 && input.capexInr > 0 ? input.capexInr / Math.abs(input.annualOpexDeltaInr) : null;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const target = await tx.target.findFirst({ where: { id: targetId, organizationId: orgId } });
      if (!target) throw new NotFoundException('Target not found.');
      if (input.facilityId && !(await tx.facility.findFirst({ where: { id: input.facilityId, organizationId: orgId } }))) throw new BadRequestException('Facility not found in your organization.');
      if (input.sourceId && !(await tx.resourceSource.findFirst({ where: { id: input.sourceId, organizationId: orgId } }))) throw new BadRequestException('Source not found in your organization.');
      const { discountRatePct, ...rest } = input;
      const a = await tx.reductionAction.create({
        data: { organizationId: orgId, targetId, ...rest, ownerId: user.userId, status: 'PLANNED', netExpectedSavingTco2e: Number(net.toFixed(4)), paybackYears: payback ? Number(payback.toFixed(2)) : null, macInrPerTco2e: Number(mac.toFixed(2)) }
      });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REDUCTION_ACTION_CREATED', resourceType: 'ReductionAction', resourceId: a.id, metadata: { macInrPerTco2e: a.macInrPerTco2e, discountRatePct } });
      return a;
    });
  }

  @Patch('actions/:id')
  @Roles('SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'PLANT_MANAGER')
  updateAction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodValidationPipe(actionUpdateSchema)) input: z.infer<typeof actionUpdateSchema>) {
    const orgId = user.organizationId!;
    return this.prisma.withTenantTx(orgId, async (tx: Tx) => {
      const a = await tx.reductionAction.findFirst({ where: { id, organizationId: orgId } });
      if (!a) throw new NotFoundException('Action not found.');
      if (a.facilityId ? !assertFacilityScope(user, a.facilityId) : user.roles.length === 1 && user.roles[0] === 'PLANT_MANAGER') throw new ForbiddenException('You are not assigned to this action\'s facility.');
      if (['COMPLETED', 'CANCELLED'].includes(a.status)) throw new ConflictException(`This action is ${a.status.toLowerCase()} and cannot change.`);
      const next = input.status ?? a.status;
      if (next === 'DELAYED' && !(input.delayReason && input.revisedEndDate)) throw new BadRequestException('A delayed action needs the reason and a revised end date.');
      if (next === 'CANCELLED' && !input.cancellationReason) throw new BadRequestException('A cancelled action needs the reason.');
      if (['COMPLETED', 'PARTIALLY_ACHIEVED'].includes(next) && input.achievedSavingTco2e == null && a.achievedSavingTco2e == null) throw new BadRequestException('Record the verified saving achieved before marking the action complete.');
      if (next === 'COMPLETED' && Number(input.achievedSavingTco2e ?? a.achievedSavingTco2e) < Number(a.netExpectedSavingTco2e) * 0.999) throw new BadRequestException('The saving achieved is below the plan. Mark it partially achieved instead.');
      const row = await tx.reductionAction.update({ where: { id }, data: { ...input, status: next } });
      await writeAuditLog(tx, { organizationId: orgId, actorId: user.userId, action: 'REDUCTION_ACTION_UPDATED', resourceType: 'ReductionAction', resourceId: id, metadata: { from: a.status, to: next } });
      return row;
    });
  }
}
