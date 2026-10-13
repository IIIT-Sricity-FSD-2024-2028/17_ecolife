import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { OptionalText, RequiredText } from '../common/validation/validators';

const MAX_PRICE = 1_000_000;

export class UpdatePlanDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(60, 'Plan name cannot be empty')
  name?: string;

  @ApiProperty({ required: false, description: 'Send an empty string to clear it.' })
  @OptionalText(200)
  description?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsInt({ message: 'Max departments must be a whole number' }) @Min(1) @Max(999) maxDepartments?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt({ message: 'Max users must be a whole number' }) @Min(1) @Max(999) maxUsers?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt({ message: 'Max resource types must be a whole number' }) @Min(1) @Max(999) maxResourceTypes?: number;

  @ApiProperty({ required: false, enum: ['weekly', 'monthly'] })
  @IsOptional()
  @IsIn(['weekly', 'monthly'], { message: 'Report frequency must be weekly or monthly' })
  reportFrequency?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE) priceMonthly?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_PRICE) priceAnnual?: number;

  @ApiProperty({ required: false, description: 'Retire a plan: it disappears from the org plan picker but existing subscribers keep it.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
