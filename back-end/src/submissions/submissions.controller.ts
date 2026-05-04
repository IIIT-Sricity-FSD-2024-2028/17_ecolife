import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
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
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Submission deleted.', this.submissionsService.remove(id)); }
}
