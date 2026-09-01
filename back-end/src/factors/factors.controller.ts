import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmissionFactorDto, FactorSourceDto, FactorVersionDto, UpdateEmissionFactorDto, UpdateFactorSourceDto, UpdateFactorVersionDto } from '../common/base.dto';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { FactorsService } from './factors.service';

@ApiTags('factors')
@Controller('factors')
@ApiHeader({ name: 'x-role', description: 'Super User manages factor governance; other roles can read factor catalogues.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class FactorsController {
  constructor(private readonly factors: FactorsService) {}

  @Get('sources') @Roles('Super User', 'COO', 'Manager', 'Analyst') sources() { return ok('Factor sources loaded.', this.factors.listSources()); }
  @Post('sources') @Roles('Super User') createSource(@Body() dto: FactorSourceDto) { return ok('Factor source created.', this.factors.createSource(dto)); }
  @Patch('sources/:id') @Roles('Super User') updateSource(@Param('id') id: string, @Body() dto: UpdateFactorSourceDto) { return ok('Factor source updated.', this.factors.updateSource(id, dto)); }
  @Put('sources/:id') @Roles('Super User') replaceSource(@Param('id') id: string, @Body() dto: UpdateFactorSourceDto) { return ok('Factor source updated.', this.factors.updateSource(id, dto)); }
  @Delete('sources/:id') @Roles('Super User') removeSource(@Param('id') id: string) { return ok('Factor source deleted.', this.factors.removeSource(id)); }

  @Get('versions') @Roles('Super User', 'COO', 'Manager', 'Analyst') versions() { return ok('Factor versions loaded.', this.factors.listVersions()); }
  @Post('versions') @Roles('Super User') createVersion(@Body() dto: FactorVersionDto) { return ok('Factor version created.', this.factors.createVersion(dto)); }
  @Patch('versions/:id') @Roles('Super User') updateVersion(@Param('id') id: string, @Body() dto: UpdateFactorVersionDto) { return ok('Factor version updated.', this.factors.updateVersion(id, dto)); }
  @Put('versions/:id') @Roles('Super User') replaceVersion(@Param('id') id: string, @Body() dto: UpdateFactorVersionDto) { return ok('Factor version updated.', this.factors.updateVersion(id, dto)); }
  @Delete('versions/:id') @Roles('Super User') removeVersion(@Param('id') id: string) { return ok('Factor version deleted.', this.factors.removeVersion(id)); }

  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Emission factors loaded.', this.factors.listFactors()); }
  @Post() @Roles('Super User') create(@Body() dto: EmissionFactorDto) { return ok('Emission factor created.', this.factors.createFactor(dto)); }
  @Patch(':id') @Roles('Super User') update(@Param('id') id: string, @Body() dto: UpdateEmissionFactorDto) { return ok('Emission factor updated.', this.factors.updateFactor(id, dto)); }
  @Put(':id') @Roles('Super User') replace(@Param('id') id: string, @Body() dto: UpdateEmissionFactorDto) { return ok('Emission factor updated.', this.factors.updateFactor(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Emission factor deleted.', this.factors.removeFactor(id)); }
}
