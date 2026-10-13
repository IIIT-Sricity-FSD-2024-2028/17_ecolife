import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class AuditLogQueryDto {
  @ApiProperty({ required: false, description: 'Exact action, e.g. LOGIN_SUCCESS' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @ApiProperty({ required: false, description: 'Entity type, e.g. ResourceRecord' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @ApiProperty({ required: false, description: 'Case-insensitive match on actor name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actor?: string;

  @ApiProperty({ required: false, description: 'ISO date/time, inclusive' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date/time, inclusive' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @ApiProperty({ required: false, description: 'Platform view only: restrict to one organization' })
  @IsOptional()
  @IsUUID('4')
  organizationId?: string;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
