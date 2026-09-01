import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApproveSubmissionDto, RequestCorrectionDto, ResubmitSubmissionDto, SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { SubmissionsService } from './submissions.service';

@ApiTags('submissions')
@Controller('submissions')
@ApiHeader({ name: 'x-role', description: 'Manager creates/locks; Analyst/COO review; Super User audits.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}
  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Submissions loaded.', this.submissionsService.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Submission loaded.', this.submissionsService.find(id)); }
  @Post() @Roles('Manager') @ApiOperation({ summary: 'Lock a manager resource submission with domain validation.' }) create(@Body() dto: SubmissionDto) { return ok('Submission locked.', this.submissionsService.create(dto)); }
  @Patch(':id') @Roles('Analyst', 'Super User') update(@Param('id') id: string, @Body() dto: UpdateSubmissionDto) { return ok('Submission updated.', this.submissionsService.update(id, dto)); }
  @Put(':id') @Roles('Analyst', 'Super User') replace(@Param('id') id: string, @Body() dto: UpdateSubmissionDto) { return ok('Submission updated.', this.submissionsService.update(id, dto)); }
  @Post(':id/approve') @Roles('Analyst', 'Super User') @ApiOperation({ summary: 'Analyst approves a calculation-ready submission.' }) approve(@Param('id') id: string, @Body() body: ApproveSubmissionDto) { return ok('Submission approved.', this.submissionsService.approve(id, body?.approvedBy)); }
  @Post(':id/request-correction') @Roles('Analyst', 'Super User') @ApiOperation({ summary: 'Analyst requests correction for a submission with required comment.' }) requestCorrection(@Param('id') id: string, @Body() dto: RequestCorrectionDto) { return ok('Correction requested.', this.submissionsService.requestCorrection(id, dto.comment, dto.requestedBy)); }
  @Post(':id/resubmit') @Roles('Manager') @ApiOperation({ summary: 'Manager resubmits corrected resource data.' }) resubmit(@Param('id') id: string, @Body() dto: ResubmitSubmissionDto) { return ok('Submission resubmitted.', this.submissionsService.resubmit(id, dto?.notes)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Submission deleted.', this.submissionsService.remove(id)); }
}
