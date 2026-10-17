import { Body, Controller, Delete, Get, Param, Patch, Post, ParseUUIDPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ResourceRecordsService } from './resource-records.service';
import { CreateResourceRecordDto, IngestTelemetryDto, ReviewDecisionDto, UpdateResourceRecordDto, WithdrawResourceRecordDto } from './dto/resource-record.dto';

@ApiTags('Resource Records (Submission Workflow)')
@Controller('resource-records')
export class ResourceRecordsController {
  constructor(private readonly service: ResourceRecordsService) {}

  @Post('ingest')
  @OrgAuth()
  @ApiOperation({
    summary: 'Automated telemetry / smart meter / IoT reading ingestion',
    description: 'Allows IoT gateways, utility APIs, and ERP systems to ingest energy and resource readings directly into Tropos with automated double-counting validation.',
  })
  ingestTelemetry(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: IngestTelemetryDto) {
    const result = this.service.ingestTelemetry(user, dto);
    return { message: 'Telemetry reading successfully ingested.', data: result };
  }

  @Post()
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Create a draft usage entry (Contributor)' })
  create(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: CreateResourceRecordDto) {
    const record = this.service.create(user, dto);
    return { message: 'Draft entry created.', data: record };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List resource records (Contributors see only their department)' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get('export/csv')
  @OrgAuth()
  @ApiOperation({ summary: 'Export authorized organization resource records as CSV' })
  exportCsv(@CurrentUser() user: AuthenticatedOrgUser, @Res() response: Response) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="tropos-resource-records.csv"');
    response.send(this.service.exportCsv(user));
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single resource record' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Edit a draft/rejected/changes-requested entry (own entries only)' })
  update(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceRecordDto) {
    const record = this.service.update(user, id, dto);
    return { message: 'Entry updated.', data: record };
  }

  @Delete(':id')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Delete a never-submitted draft entry (Contributor, own entries only)' })
  deleteDraft(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deleteDraft(user, id);
  }

  @Post(':id/withdraw')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Withdraw a pending submitted entry while retaining its history (Contributor, own entry only)' })
  withdraw(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WithdrawResourceRecordDto) {
    const record = this.service.withdraw(user, id, dto);
    return { message: 'Entry withdrawn. Its history and evidence were retained.', data: record };
  }

  @Post(':id/submit')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Submit an entry for review (first time or resubmission)' })
  submit(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const record = this.service.submit(user, id);
    return { message: 'Entry submitted for review.', data: record };
  }

  @Post(':id/claim')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Claim a submission for review with a 15-minute lease (Reviewer)' })
  claim(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const record = this.service.claim(user, id);
    return { message: 'Submission claimed for review.', data: record };
  }

  @Post(':id/release')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Release a claimed submission back to the general queue (Reviewer)' })
  release(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const record = this.service.release(user, id);
    return { message: 'Submission released back to queue.', data: record };
  }

  @Post(':id/approve')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Approve a submission — locks it and triggers calculation (Reviewer)' })
  approve(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDecisionDto) {
    const record = this.service.approve(user, id, dto);
    return { message: 'Submission approved, calculated, and locked.', data: record };
  }

  @Post(':id/reject')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Reject a submission (Reviewer)' })
  reject(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDecisionDto) {
    const record = this.service.reject(user, id, dto);
    return { message: 'Submission rejected.', data: record };
  }

  @Post(':id/request-changes')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Request changes on a submission (Reviewer)' })
  requestChanges(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDecisionDto) {
    const record = this.service.requestChanges(user, id, dto);
    return { message: 'Changes requested.', data: record };
  }

  @Post(':id/recalculate')
  @OrgAuth('REVIEWER')
  @ApiOperation({
    summary: 'Manually recalculate a locked entry (Reviewer)',
    description: 'Useful after a factor correction that does not itself require an amendment to the record.',
  })
  recalculate(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = this.service.recalculate(user, id);
    return { message: 'Recalculated.', data: result };
  }
}
