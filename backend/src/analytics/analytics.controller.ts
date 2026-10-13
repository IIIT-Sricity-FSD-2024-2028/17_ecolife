import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { AuthenticatedOrgUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import { EmissionsQueryDto } from './analytics.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('emissions')
  @OrgAuth('REVIEWER', 'EXECUTIVE', 'ORG_ADMIN')
  @ApiOperation({
    summary: 'Emissions roll-up: totals, monthly trend, department performance vs targets, factor lineage',
  })
  emissions(@CurrentUser() user: AuthenticatedOrgUser, @Query() query: EmissionsQueryDto) {
    return this.service.emissions(user, query);
  }
}
