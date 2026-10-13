import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OptionalText, RequiredText, STRICT_DATE, TrimEach } from '../../common/validation/validators';

const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];

export class CreateResourceTypeDto {
  @ApiProperty({ example: 'Natural Gas' })
  @RequiredText(120, 'Resource type name is required')
  name!: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES, { message: 'Category must be one of: ' + CATEGORIES.join(', ') })
  category!: string;

  @ApiProperty({ required: false })
  @OptionalText(500)
  description?: string;

  @ApiProperty({ required: false, description: 'Usage above this quantity requires supporting evidence.' })
  @IsOptional()
  @IsNumber({}, { message: 'Evidence threshold must be a number' })
  @Min(0, { message: 'Evidence threshold cannot be negative' })
  @Max(1_000_000_000)
  evidenceThreshold?: number;

  @ApiProperty({ example: ['m3', 'kWh'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one unit must be defined' })
  @ArrayMaxSize(20, { message: 'At most 20 units are allowed' })
  @ArrayUnique({ message: 'Units must be unique' })
  @TrimEach()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Units cannot be empty' })
  @MaxLength(30, { each: true, message: 'A unit must be at most 30 characters' })
  units!: string[];

  @ApiProperty({ example: 'm3' })
  @RequiredText(30, 'Default unit is required')
  defaultUnit!: string;
}

export class CreateFactorVersionDto {
  @ApiProperty()
  @IsUUID('4', { message: 'resourceTypeId must be a valid UUID' })
  resourceTypeId!: string;

  @ApiProperty()
  @IsUUID('4', { message: 'sourceId must be a valid UUID' })
  sourceId!: string;

  @ApiProperty({ required: false, description: 'Omit for a global default; set for an org-specific override' })
  @IsOptional()
  @IsUUID('4', { message: 'organizationId must be a valid UUID' })
  organizationId?: string;

  @ApiProperty({ example: 'CO2' })
  @RequiredText(20, 'Gas is required')
  gas!: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 8 }, { message: 'Factor value must be a number' })
  @Min(0, { message: 'Factor value cannot be negative' })
  @Max(1_000_000, { message: 'Factor value is unrealistically large' })
  factorValue!: number;

  @ApiProperty({ default: 1 })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'GWP must be a number' })
  @IsPositive({ message: 'GWP must be greater than 0' })
  @Max(100_000, { message: 'GWP is unrealistically large' })
  gwp!: number;

  @ApiProperty({ example: 'kg CO2 per kWh' })
  @RequiredText(50, 'Unit is required')
  unit!: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString(STRICT_DATE, { message: 'effectiveFrom must be a valid date' })
  effectiveFrom!: string;

  @ApiProperty({ required: false, description: 'Why this factor is used / where it comes from. Required for organization overrides.' })
  @OptionalText(500)
  notes?: string;
}
