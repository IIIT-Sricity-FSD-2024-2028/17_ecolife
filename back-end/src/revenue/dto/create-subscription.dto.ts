import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'org-techcorp' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'plan-pro' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'])
  status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

  @ApiProperty({ example: 'MONTHLY', enum: ['MONTHLY', 'ANNUAL'] })
  @IsIn(['MONTHLY', 'ANNUAL'])
  billingCycle: 'MONTHLY' | 'ANNUAL';

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-04-01' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 125000, description: 'Negotiated custom price per billing cycle for Enterprise plans.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice?: number;

  @ApiPropertyOptional({ example: ['addon-analytics'], type: [String] })
  @IsOptional()
  @IsArray()
  addonIds?: string[];
}
