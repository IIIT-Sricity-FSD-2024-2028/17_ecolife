import { Body, Controller, Delete, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Post()
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Create a department (Org Admin only)' })
  create(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: CreateDepartmentDto) {
    const dept = this.service.create(user, dto);
    return { message: 'Department created.', data: dept };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List all departments in your organization' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single department' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Update a department (Org Admin only)' })
  update(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    const dept = this.service.update(user, id, dto);
    return { message: 'Department updated.', data: dept };
  }

  @Delete(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a department (Org Admin only, must be empty)' })
  remove(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = this.service.remove(user, id);
    return { message: 'Department deleted.', data: result };
  }
}
