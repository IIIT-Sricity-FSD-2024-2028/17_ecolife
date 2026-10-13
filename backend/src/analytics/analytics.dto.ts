import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class EmissionsQueryDto {
  @ApiProperty({ required: false, description: 'Period start (ISO date). Defaults to the earliest locked entry.' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiProperty({ required: false, description: 'Period end (ISO date). Defaults to the latest locked entry.' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}
