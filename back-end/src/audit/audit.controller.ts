import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditLogDto, UpdateAuditLogDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit-logs')
@ApiHeader({ name: 'x-role', description: 'Super User sees master trail; COO can view org trail.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}
  @Get() @Roles('Super User', 'COO') list() { return ok('Audit logs loaded.', this.auditService.list()); }
  @Get(':id') @Roles('Super User', 'COO') find(@Param('id') id: string) { return ok('Audit log loaded.', this.auditService.find(id)); }
  @Post() @Roles('Super User') create(@Body() dto: AuditLogDto) { return ok('Audit log created.', this.auditService.create(dto)); }
  @Patch(':id') @Roles('Super User') update(@Param('id') id: string, @Body() dto: UpdateAuditLogDto) { return ok('Audit log updated.', this.auditService.update(id, dto)); }
  @Put(':id') @Roles('Super User') replace(@Param('id') id: string, @Body() dto: UpdateAuditLogDto) { return ok('Audit log updated.', this.auditService.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Audit log deleted.', this.auditService.remove(id)); }
}
