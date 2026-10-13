import { Body, Controller, Get, Param, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { GenerateReportDto, ReportDecisionDto, SubmitReportDto } from './dto/report.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Generate a draft report from locked data in a period (Reviewer)' })
  generate(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: GenerateReportDto) {
    const report = this.service.generate(user, dto);
    return { message: 'Report draft generated.', data: report };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List reports' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single report' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Post(':id/submit')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Submit a draft report for Executive approval' })
  submit(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitReportDto) {
    const report = this.service.submitForApproval(user, id, dto?.note);
    return { message: 'Report submitted for approval.', data: report };
  }

  @Post(':id/approve')
  @OrgAuth('EXECUTIVE')
  @ApiOperation({
    summary: 'Approve and publish a report (Executive)',
    description: 'Freezes the report permanently — corrections require a new version.',
  })
  approve(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDecisionDto) {
    const report = this.service.approve(user, id, dto);
    return { message: 'Report approved and published.', data: report };
  }

  @Post(':id/request-revision')
  @OrgAuth('EXECUTIVE')
  @ApiOperation({ summary: 'Send a report back for revision (Executive)' })
  requestRevision(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDecisionDto) {
    const report = this.service.requestRevision(user, id, dto);
    return { message: 'Revision requested.', data: report };
  }

  @Post(':id/new-version')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Create a new version of a report flagged for revision (Reviewer)' })
  newVersion(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const report = this.service.createNewVersion(user, id);
    return { message: 'New report version created.', data: report };
  }
}
