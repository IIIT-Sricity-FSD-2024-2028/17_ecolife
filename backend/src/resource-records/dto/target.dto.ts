import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsUUID, Max, ValidateIf } from 'class-validator';
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

export class UpdateTargetDto {
  @ApiProperty({ required: false, example: 'Cut Plant A electricity 10%' })
  @IsOptional()
  @OptionalText(100)
  name?: string;

  @ApiProperty({ required: false, nullable: true, description: 'Pass null for an organization-wide target.' })
  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string | null;

  @ApiProperty({ required: false, nullable: true, enum: CATEGORIES })
  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsIn(CATEGORIES, { message: 'Category must be one of: ' + CATEGORIES.join(', ') })
  resourceCategory?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Target value must be a number' })
  @IsPositive({ message: 'Target value must be greater than 0' })
  @Max(1_000_000_000_000, { message: 'Target value is unrealistically large' })
  targetValue?: number;

  @ApiProperty({ required: false, enum: ['usage', 'cost', 'emissions'] })
  @IsOptional()
  @IsIn(['usage', 'cost', 'emissions'], { message: 'Metric must be usage, cost or emissions' })
  metric?: string;

  @ApiProperty({ example: '2026-07-01', required: false })
  @IsOptional()
  @IsDateString(STRICT_DATE, { message: 'periodStart must be a valid date' })
  periodStart?: string;

  @ApiProperty({ example: '2026-09-30', required: false })
  @IsOptional()
  @IsDateString(STRICT_DATE, { message: 'periodEnd must be a valid date' })
  periodEnd?: string;

  @ApiProperty({ required: false, description: 'Rationale or methodology behind the target.' })
  @IsOptional()
  @OptionalText(500)
  notes?: string;
}
