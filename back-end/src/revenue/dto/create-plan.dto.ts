import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Starter' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'For small organizations beginning tracking.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 14999 })
  @IsNumber()
  @Min(0)
  priceMonthly: number;

  @ApiProperty({ example: 149990 })
  @IsNumber()
  @Min(0)
  priceAnnual: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  maxUsers: number;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Min(1)
  maxDepartments: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSubmissions?: number;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(1)
  maxReports: number;


  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  maxStorage: number;

  @ApiProperty({ example: ['Basic emissions tracking', 'Basic reports'] })
  @IsArray()
  features: string[];

  @ApiPropertyOptional({ example: 17 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualDiscount?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAdditionalUsers?: number;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalUserPriceMonthly?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalUserPriceAnnual?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAdditionalDepartments?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalDepartmentPriceMonthly?: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalDepartmentPriceAnnual?: number;

  @ApiPropertyOptional({ example: 'Standard Business Hours' })
  @IsOptional()
  @IsString()
  supportLevel?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
