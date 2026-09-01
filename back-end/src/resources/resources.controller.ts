import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResourceCategoryDto, ResourceTypeDto, ResourceUnitCompatibilityDto, UnitDto, UpdateResourceCategoryDto, UpdateResourceTypeDto, UpdateResourceUnitCompatibilityDto, UpdateUnitDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@Controller('resources')
@ApiHeader({ name: 'x-role', description: 'Super User manages master data; other roles can read allowed resource masters.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('categories') @Roles('Super User', 'COO', 'Manager', 'Analyst') categories() { return ok('Resource categories loaded.', this.resources.listCategories()); }
  @Post('categories') @Roles('Super User') createCategory(@Body() dto: ResourceCategoryDto) { return ok('Resource category created.', this.resources.createCategory(dto)); }
  @Patch('categories/:id') @Roles('Super User') updateCategory(@Param('id') id: string, @Body() dto: UpdateResourceCategoryDto) { return ok('Resource category updated.', this.resources.updateCategory(id, dto)); }
  @Put('categories/:id') @Roles('Super User') replaceCategory(@Param('id') id: string, @Body() dto: UpdateResourceCategoryDto) { return ok('Resource category updated.', this.resources.updateCategory(id, dto)); }
  @Delete('categories/:id') @Roles('Super User') removeCategory(@Param('id') id: string) { return ok('Resource category deleted.', this.resources.removeCategory(id)); }

  @Get('units') @Roles('Super User', 'COO', 'Manager', 'Analyst') units() { return ok('Units loaded.', this.resources.listUnits()); }
  @Post('units') @Roles('Super User') createUnit(@Body() dto: UnitDto) { return ok('Unit created.', this.resources.createUnit(dto)); }
  @Patch('units/:id') @Roles('Super User') updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) { return ok('Unit updated.', this.resources.updateUnit(id, dto)); }
  @Put('units/:id') @Roles('Super User') replaceUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) { return ok('Unit updated.', this.resources.updateUnit(id, dto)); }
  @Delete('units/:id') @Roles('Super User') removeUnit(@Param('id') id: string) { return ok('Unit deleted.', this.resources.removeUnit(id)); }

  @Get('types') @Roles('Super User', 'COO', 'Manager', 'Analyst') types() { return ok('Resource types loaded.', this.resources.listTypes()); }
  @Post('types') @Roles('Super User') createType(@Body() dto: ResourceTypeDto) { return ok('Resource type created.', this.resources.createType(dto)); }
  @Patch('types/:id') @Roles('Super User') updateType(@Param('id') id: string, @Body() dto: UpdateResourceTypeDto) { return ok('Resource type updated.', this.resources.updateType(id, dto)); }
  @Put('types/:id') @Roles('Super User') replaceType(@Param('id') id: string, @Body() dto: UpdateResourceTypeDto) { return ok('Resource type updated.', this.resources.updateType(id, dto)); }
  @Delete('types/:id') @Roles('Super User') removeType(@Param('id') id: string) { return ok('Resource type deleted.', this.resources.removeType(id)); }

  @Get('compatibilities') @Roles('Super User', 'COO', 'Manager', 'Analyst') compatibilities() { return ok('Resource-unit compatibilities loaded.', this.resources.listCompatibilities()); }
  @Post('compatibilities') @Roles('Super User') createCompatibility(@Body() dto: ResourceUnitCompatibilityDto) { return ok('Compatibility created.', this.resources.createCompatibility(dto)); }
  @Patch('compatibilities/:id') @Roles('Super User') updateCompatibility(@Param('id') id: string, @Body() dto: UpdateResourceUnitCompatibilityDto) { return ok('Compatibility updated.', this.resources.updateCompatibility(id, dto)); }
  @Put('compatibilities/:id') @Roles('Super User') replaceCompatibility(@Param('id') id: string, @Body() dto: UpdateResourceUnitCompatibilityDto) { return ok('Compatibility updated.', this.resources.updateCompatibility(id, dto)); }
  @Delete('compatibilities/:id') @Roles('Super User') removeCompatibility(@Param('id') id: string) { return ok('Compatibility deleted.', this.resources.removeCompatibility(id)); }
}
