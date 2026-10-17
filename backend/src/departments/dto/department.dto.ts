import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { OptionalText, RequiredText } from '../../common/validation/validators';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Fleet & Logistics' })
  @RequiredText(120, 'Department name is required')
  name!: string;

  @ApiProperty({ required: false })
  @OptionalText(500)
  description?: string;

  @ApiProperty({ required: false, type: [String], description: 'Permitted resource type IDs under this department’s operational boundary' })
  @IsOptional()
  allowedResourceTypeIds?: string[];
}

export class UpdateDepartmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Department name cannot be empty')
  name?: string;

  @ApiProperty({ required: false })
  @OptionalText(500)
  description?: string;

  @ApiProperty({ required: false, type: [String], description: 'Permitted resource type IDs under this department’s operational boundary' })
  @IsOptional()
  allowedResourceTypeIds?: string[];
}
