import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { RequiredText } from '../../common/validation/validators';

export class RespondToAlertDto {
  @ApiProperty({ example: 'Explanation: one-off equipment test.' })
  @RequiredText(2000, 'Please describe how this was addressed')
  responseText!: string;

  @ApiProperty({ enum: ['fixed', 'confirmed_accurate'] })
  @IsIn(['fixed', 'confirmed_accurate'], { message: 'Action must be "fixed" or "confirmed_accurate"' })
  action!: 'fixed' | 'confirmed_accurate';
}
