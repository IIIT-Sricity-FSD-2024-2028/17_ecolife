import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RequiredText } from '../../common/validation/validators';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'March data due Friday' })
  @RequiredText(100, 'A title is required')
  title!: string;

  @ApiProperty({ example: 'Please submit and attach evidence for all March entries by end of day Friday.' })
  @RequiredText(1000, 'A message is required')
  body!: string;

  @ApiProperty({ required: false, description: 'Omit to announce to the whole organization' })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @ApiProperty({ required: false, default: 14, description: 'How long it stays visible (1-60 days)' })
  @IsOptional()
  @IsInt({ message: 'Days must be a whole number' })
  @Min(1, { message: 'At least 1 day' })
  @Max(60, { message: 'At most 60 days' })
  expiresInDays?: number;
}
