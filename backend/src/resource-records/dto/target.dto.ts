import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsUUID, Max } from 'class-validator';
import { IsNotBefore, OptionalText, STRICT_DATE } from '../../common/validation/validators';

const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];

export class CreateTargetDto {
  @ApiProperty({ required: false, example: 'Cut Plant A electricity 10%' })
  @OptionalText(100)
  name?: string;

  @ApiProperty({ required: false, description: 'Omit for an organization-wide target.' })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @ApiProperty({ required: false, enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES, { message: 'Category must be one of: ' + CATEGORIES.join(', ') })
  resourceCategory?: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Target value must be a number' })
  @IsPositive({ message: 'Target value must be greater than 0' })
  @Max(1_000_000_000_000, { message: 'Target value is unrealistically large' })
  targetValue!: number;

  @ApiProperty({ enum: ['usage', 'cost', 'emissions'] })
  @IsIn(['usage', 'cost', 'emissions'], { message: 'Metric must be usage, cost or emissions' })
  metric!: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString(STRICT_DATE, { message: 'periodStart must be a valid date' })
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString(STRICT_DATE, { message: 'periodEnd must be a valid date' })
  @IsNotBefore('periodStart', { message: 'Period end cannot be before the start date' })
  periodEnd!: string;

  @ApiProperty({ required: false, description: 'Rationale or methodology behind the target.' })
  @OptionalText(500)
  notes?: string;
}
