import { ALL_MODULES } from '../../config/platform.constants';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as generated from '../../generated/prisma';
import { INDIAN_STATES, TRIAL_DAYS } from '../../config/platform.constants';
import { listUnits } from '../../common/utils/units';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HAZARDOUS_WASTE, TREATMENT_LEVELS } from '../resources/resources.controller';

/** Every choice list the screens need, read from the database schema itself so the UI never carries its own copy. */
const ENUMS: Record<string, string[]> = {};
for (const [name, value] of Object.entries(generated as Record<string, any>)) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const vals = Object.values(value);
    if (vals.length > 0 && vals.every((v) => typeof v === 'string') && Object.entries(value).every(([k, v]) => k === v)) ENUMS[name] = vals as string[];
  }
}

@ApiTags('Meta')
@Controller('meta')
export class MetaController {
  /** Needed before sign-in (the sign-up form), so no token is required. Nothing here is customer data. */
  @Get('public')
  publicOptions() {
    return { trialDays: TRIAL_DAYS, states: INDIAN_STATES, units: listUnits() };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('options')
  options() {
    return { enums: ENUMS, rules: { modules: [...ALL_MODULES], hazardousWasteCategories: HAZARDOUS_WASTE, treatmentLevels: TREATMENT_LEVELS, units: listUnits() } };
  }
}
