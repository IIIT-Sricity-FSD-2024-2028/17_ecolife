import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApproveReportDto, ReportDto, RevisionDto, UpdateReportDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
@ApiHeader({ name: 'x-role', description: 'Analyst generates/revises; COO approves or requests revisions.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}
  @Get() @Roles('Super User', 'COO', 'Analyst') list() { return ok('Reports loaded.', this.reportsService.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Analyst') find(@Param('id') id: string) { return ok('Report loaded.', this.reportsService.find(id)); }
  @Post() @Roles('Analyst') create(@Body() dto: ReportDto) { return ok('Report created.', this.reportsService.create(dto)); }
  @Patch(':id') @Roles('Analyst', 'COO', 'Super User') update(@Param('id') id: string, @Body() dto: UpdateReportDto) { return ok('Report updated.', this.reportsService.update(id, dto)); }
  @Put(':id') @Roles('Analyst', 'COO', 'Super User') replace(@Param('id') id: string, @Body() dto: UpdateReportDto) { return ok('Report updated.', this.reportsService.update(id, dto)); }
  @Post(':id/approve') @Roles('COO') @ApiOperation({ summary: 'COO approves a generated analyst report.' }) approve(@Param('id', ParseIntPipe) id: number, @Body() body: ApproveReportDto) { return ok('Report approved.', this.reportsService.approve(id, body?.approvedBy || 'COO')); }
  @Post(':id/revision') @Roles('COO') @ApiOperation({ summary: 'COO requests report revision with required comment.' }) revision(@Param('id', ParseIntPipe) id: number, @Body() dto: RevisionDto) { return ok('Revision requested.', this.reportsService.requestRevision(id, dto.comment, dto.requestedBy || 'COO')); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Report deleted.', this.reportsService.remove(id)); }
}
