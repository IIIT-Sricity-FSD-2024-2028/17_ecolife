import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Post()
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Create a location under a department (Org Admin only)' })
  create(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: CreateLocationDto) {
    const location = this.service.create(user, dto);
    return { message: 'Location created.', data: location };
  }

  @Get()
  @OrgAuth()
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiOperation({ summary: 'List locations, optionally filtered by department' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser, @Query('departmentId', new ParseUUIDPipe({ optional: true })) departmentId?: string) {
    return this.service.findAll(user, departmentId);
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single location' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Update a location (Org Admin only)' })
  update(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    const location = this.service.update(user, id, dto);
    return { message: 'Location updated.', data: location };
  }

  @Delete(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a location (Org Admin only, must have no records attached)' })
  remove(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const result = this.service.remove(user, id);
    return { message: 'Location deleted.', data: result };
  }
}
