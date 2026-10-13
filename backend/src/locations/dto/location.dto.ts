import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { OptionalText, RequiredText } from '../../common/validation/validators';

export class CreateLocationDto {
  @ApiProperty()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId!: string;

  @ApiProperty({ example: 'Plant A' })
  @RequiredText(120, 'Location name is required')
  name!: string;

  @ApiProperty({ required: false })
  @OptionalText(250)
  address?: string;
}

export class UpdateLocationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Location name cannot be empty')
  name?: string;

  @ApiProperty({ required: false })
  @OptionalText(250)
  address?: string;
}
