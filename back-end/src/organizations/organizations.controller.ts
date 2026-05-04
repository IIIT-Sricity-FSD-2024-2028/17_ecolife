import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationDto, UpdateOrganizationDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@Controller('organizations')
@ApiHeader({ name: 'x-role', description: 'Super User manages organizations; COO can read/update own organization.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}
  @Get() @Roles('Super User', 'COO', 'Analyst') list() { return ok('Organizations loaded.', this.organizationsService.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Analyst') find(@Param('id') id: string) { return ok('Organization loaded.', this.organizationsService.find(id)); }
  @Post() @Roles('Super User') create(@Body() dto: OrganizationDto) { return ok('Organization created.', this.organizationsService.create(dto)); }
  @Patch(':id') @Roles('Super User', 'COO') update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return ok('Organization updated.', this.organizationsService.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'COO') replace(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) { return ok('Organization updated.', this.organizationsService.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Organization deleted.', this.organizationsService.remove(id)); }
}
