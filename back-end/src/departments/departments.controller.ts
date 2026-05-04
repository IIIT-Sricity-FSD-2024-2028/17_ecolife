import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DepartmentDto, UpdateDepartmentDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';

@ApiTags('departments')
@Controller('departments')
@ApiHeader({ name: 'x-role', description: 'COO and Super User manage departments; Analyst/Manager can read.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}
  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Departments loaded.', this.departmentsService.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Department loaded.', this.departmentsService.find(id)); }
  @Post() @Roles('Super User', 'COO') create(@Body() dto: DepartmentDto) { return ok('Department created.', this.departmentsService.create(dto)); }
  @Patch(':id') @Roles('Super User', 'COO') update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return ok('Department updated.', this.departmentsService.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'COO') replace(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return ok('Department updated.', this.departmentsService.update(id, dto)); }
  @Delete(':id') @Roles('Super User', 'COO') remove(@Param('id') id: string) { return ok('Department deleted.', this.departmentsService.remove(id)); }
}
