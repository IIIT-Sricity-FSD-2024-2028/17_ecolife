import { Body, Controller, Get, Param, Patch, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuth } from '../auth/decorators/protected.decorator';
import { AuthenticatedPlatformAdmin, CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlatformInsightsService } from './platform-insights.service';
import { UpdatePlanDto } from './platform-insights.dto';

@ApiTags('Platform — Insights')
@Controller('platform')
export class PlatformInsightsController {
  constructor(private readonly service: PlatformInsightsService) {}

  @Get('overview')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Platform dashboard: orgs, people, activity, factor coverage, system health' })
  overview() {
    return this.service.overview();
  }

  @Get('organizations-overview')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Organizations with plan, owner, headcount and last activity' })
  organizations() {
    return this.service.organizations();
  }

  @Get('subscriptions')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Every organization subscription with its plan and invoiced total' })
  subscriptions() {
    return this.service.subscriptions();
  }

  @Get('plans')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'All plans (including retired ones) with subscriber counts' })
  plans() {
    return this.service.plans();
  }

  @Patch('plans/:id')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Edit a plan’s limits, prices or availability' })
  updatePlan(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return { message: 'Plan updated.', data: this.service.updatePlan(admin, id, dto) };
  }

  @Get('resource-types')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Resource type catalog with factor coverage' })
  resourceTypes() {
    return this.service.resourceTypes();
  }

  @Get('factors/sources')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Emission factor sources' })
  factorSources() {
    return this.service.factorSources();
  }

  @Get('factors/versions/:resourceTypeId')
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Every factor version (global and organization overrides) for a resource type' })
  factorVersions(@Param('resourceTypeId', ParseUUIDPipe) resourceTypeId: string) {
    return this.service.factorVersions(resourceTypeId);
  }
}
