import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { facilityScope } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Global Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async globalSearch(@CurrentUser() user: AuthUser, @Query('q') rawQ = '', @Query('type') type?: string, @Query('limit') limitRaw?: string) {
    const q0 = String(rawQ).trim().slice(0, 100);
    // % and _ are ordinary characters to a person typing, not wildcards.
    const q = q0.replace(/[\\%_]/g, '\\$&');
    // 5 per kind for the quick box; up to 50 when the person asks to see all of one kind.
    const limit = limitRaw === undefined ? 5 : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('limit must be a whole number from 1 to 50.');
    if (type && !['facility', 'source', 'entry', 'supplier', 'target', 'factor'].includes(type)) throw new BadRequestException('Unknown result type.');
    const scope = facilityScope(user);
    if (q0.length < 2) {
      return { query: q0, results: [] };
    }
    const orgId = user.organizationId!;

    const results = await this.prisma.withTenantTx(orgId, async (tx) => {
      const [facilities, sources, entries, suppliers, targets, factors] = await Promise.all([
        tx.facility.findMany({
          where: { organizationId: orgId, ...(scope ? { id: { in: scope } } : {}), OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] },
          take: limit
        }),
        tx.resourceSource.findMany({
          where: { organizationId: orgId, ...(scope ? { facilityId: { in: scope } } : {}), OR: [{ name: { contains: q, mode: 'insensitive' } }, { meterSerialNo: { contains: q, mode: 'insensitive' } }] },
          include: { facility: { select: { name: true } } },
          take: limit
        }),
        tx.resourceEntry.findMany({
          where: { organizationId: orgId, ...(scope ? { source: { facilityId: { in: scope } } } : {}), OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { source: { name: { contains: q, mode: 'insensitive' } } }] },
          include: { source: { select: { name: true } }, period: { select: { label: true } } },
          take: limit
        }),
        tx.supplier.findMany({
          where: { organizationId: orgId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }] },
          take: limit
        }),
        tx.target.findMany({
          where: { organizationId: orgId, name: { contains: q, mode: 'insensitive' } },
          take: limit
        }),
        tx.emissionFactor.findMany({
          where: {
            OR: [{ organizationId: null }, { organizationId: orgId }],
            AND: [{ OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }]
          },
          take: limit
        })
      ]);

      return [
        ...facilities.map((f) => ({ kind: 'facility', type: 'Facility', id: f.id, title: f.name, subtitle: `${f.city}, ${f.state}`, path: '/sustainability/boundary' })),
        ...sources.map((s) => ({ kind: 'source', type: 'Meter / Source', id: s.id, title: s.name, subtitle: `${s.facility.name} · ${s.domain}`, path: '/plant/fuels-energy' })),
        ...entries.map((e) => ({ kind: 'entry', type: 'Activity Entry', id: e.id, title: e.invoiceNumber || e.source.name, subtitle: `${e.period.label} · ${Number(e.calculatedTco2eAr6).toFixed(2)} tCO₂e`, path: '/plant/fuels-energy' })),
        ...suppliers.map((s) => ({ kind: 'supplier', type: 'Supplier', id: s.id, title: s.name, subtitle: s.category, path: '/sustainability/value-chain' })),
        ...targets.map((t) => ({ kind: 'target', type: 'Target', id: t.id, title: t.name, subtitle: `${t.baseYear} → ${t.targetYear} (${t.status})`, path: '/sustainability/targets' })),
        ...factors.map((f) => ({ kind: 'factor', type: 'Emission Factor', id: f.id, title: f.code, subtitle: `${f.name} (${f.sourceAuthority})`, path: '/sustainability/boundary' }))
      ];
    });

    const shown = type ? results.filter((r) => r.kind === type) : results;
    return { query: q0, results: shown };
  }
}
