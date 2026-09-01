import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResourceRecordDto, UpdateResourceRecordDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { ResourceRecordsService } from './resource-records.service';

@ApiTags('resource-records')
@Controller('resource-records')
@ApiHeader({ name: 'x-role', description: 'Manager creates records; Analyst/COO review; Super User has full control.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class ResourceRecordsController {
  constructor(private readonly records: ResourceRecordsService) {}

  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Resource records loaded.', this.records.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Resource record loaded.', this.records.find(id)); }
  @Post() @Roles('Super User', 'Manager') create(@Body() dto: ResourceRecordDto) { return ok('Resource record created and calculated.', this.records.create(dto)); }
  @Patch(':id') @Roles('Super User', 'Manager') update(@Param('id') id: string, @Body() dto: UpdateResourceRecordDto) { return ok('Resource record updated.', this.records.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'Manager') replace(@Param('id') id: string, @Body() dto: UpdateResourceRecordDto) { return ok('Resource record updated.', this.records.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Resource record deleted.', this.records.remove(id)); }
}
