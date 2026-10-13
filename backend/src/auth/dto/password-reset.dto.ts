import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEmailAddress, IsNewPassword } from '../../common/validation/validators';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmailAddress()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsNewPassword()
  newPassword!: string;
}
