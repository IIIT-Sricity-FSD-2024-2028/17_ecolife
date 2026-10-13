import { Body, Controller, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ResourceRecordsService } from './resource-records.service';
import { CreateResourceRecordDto, ReviewDecisionDto, UpdateResourceRecordDto } from './dto/resource-record.dto';

@ApiTags('Resource Records (Submission Workflow)')
@Controller('resource-records')
export class ResourceRecordsController {
  constructor(private readonly service: ResourceRecordsService) {}

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

  @Post(':id/submit')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Submit an entry for review (first time or resubmission)' })
  submit(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const record = this.service.submit(user, id);
    return { message: 'Entry submitted for review.', data: record };
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
