import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { OptionalText, RequiredText } from '../../common/validation/validators';

const MAX_PRICE = 1_000_000;

export class CreatePlanDto {
  @ApiProperty({ example: 'Growth' })
  @RequiredText(60, 'Plan name is required')
  name!: string;

  @ApiProperty({ required: false, description: 'One line shown on the plan card: who the plan is for.' })
  @OptionalText(200)
  description?: string;

  @ApiProperty({ description: '999 means unlimited.' })
  @IsInt({ message: 'Max departments must be a whole number' }) @Min(1) @Max(999)
  maxDepartments!: number;

  @ApiProperty()
  @IsInt({ message: 'Max users must be a whole number' }) @Min(1) @Max(999)
  maxUsers!: number;

  @ApiProperty()
  @IsInt({ message: 'Max resource types must be a whole number' }) @Min(1) @Max(999)
  maxResourceTypes!: number;

  @ApiProperty({ enum: ['weekly', 'monthly'] })
  @IsIn(['weekly', 'monthly'], { message: 'Report frequency must be weekly or monthly' })
  reportFrequency!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Monthly price must be a number (up to 2 decimal places)' }) @Min(0) @Max(MAX_PRICE)
  priceMonthly!: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Annual price must be a number (up to 2 decimal places)' }) @Min(0) @Max(MAX_PRICE)
  priceAnnual!: number;
}

export class ChangePlanDto {
  @ApiProperty()
  @IsUUID('4', { message: 'planId must be a valid UUID' })
  planId!: string;
}
