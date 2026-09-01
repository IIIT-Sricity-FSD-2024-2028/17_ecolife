import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { CalculationsService } from './calculations.service';

@ApiTags('calculations')
@Controller('calculations')
@ApiHeader({ name: 'x-role', description: 'Authorized roles can review calculated impact results; Super User/Analyst can trigger recalculation.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class CalculationsController {
  constructor(private readonly calculationsService: CalculationsService) {}

  @Get() @Roles('Super User', 'COO', 'Analyst') calculations() { return ok('Calculation runs loaded.', this.calculationsService.calculations()); }
  @Get('results') @Roles('Super User', 'COO', 'Manager', 'Analyst') results() { return ok('Impact results loaded.', this.calculationsService.results()); }
  @Post('records/:id/recalculate') @Roles('Super User', 'Analyst') recalculate(@Param('id') id: string) { return ok('Resource record recalculated.', this.calculationsService.recalculateRecord(id)); }
}
