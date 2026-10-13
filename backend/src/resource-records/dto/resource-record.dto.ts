import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsNotBefore, OptionalText, RequiredText, STRICT_DATE } from '../../common/validation/validators';

const MAX_AMOUNT = 1_000_000_000;

export class CreateResourceRecordDto {
  @ApiProperty()
  @IsUUID('4', { message: 'resourceTypeId must be a valid UUID' })
  resourceTypeId!: string;

  @ApiProperty({ example: 1250.5 })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Quantity must be a number (up to 4 decimal places)' })
  @Min(0.0001, { message: 'Quantity must be greater than 0' })
  @Max(MAX_AMOUNT, { message: 'Quantity is unrealistically large' })
  quantity!: number;

  @ApiProperty({ example: 'kWh' })
  @RequiredText(30, 'Unit is required')
  unit!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Cost must be a number (up to 2 decimal places)' })
  @Min(0, { message: 'Cost cannot be negative' })
  @Max(MAX_AMOUNT, { message: 'Cost is unrealistically large' })
  cost?: number;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString(STRICT_DATE, { message: 'periodStart must be a valid date' })
  periodStart!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString(STRICT_DATE, { message: 'periodEnd must be a valid date' })
  @IsNotBefore('periodStart', { message: 'Period end cannot be before the start date' })
  periodEnd!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4', { message: 'locationId must be a valid UUID' })
  locationId?: string;

  @ApiProperty({ required: false })
  @OptionalText(1000)
  notes?: string;
}

export class UpdateResourceRecordDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Quantity must be a number (up to 4 decimal places)' })
  @Min(0.0001, { message: 'Quantity must be greater than 0' })
  @Max(MAX_AMOUNT, { message: 'Quantity is unrealistically large' })
  quantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(30, 'Unit cannot be empty')
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Cost must be a number (up to 2 decimal places)' })
  @Min(0, { message: 'Cost cannot be negative' })
  @Max(MAX_AMOUNT, { message: 'Cost is unrealistically large' })
  cost?: number;

  @ApiProperty({ required: false })
  @OptionalText(1000)
  notes?: string;
}

export class ReviewDecisionDto {
  @ApiProperty({ required: false })
  @OptionalText(1000)
  comment?: string;
}
