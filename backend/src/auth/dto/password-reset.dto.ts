import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsEmailAddress, IsNewPassword } from '../../common/validation/validators';

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmailAddress()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ required: false, description: 'Emailed reset token. Send this OR email + code.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Reset token is required' })
  @MaxLength(256)
  token?: string;

  @ApiProperty({ required: false, description: 'Demo mode only: the account email the code was requested for.' })
  @IsOptional()
  @IsEmailAddress()
  email?: string;

  @ApiProperty({ required: false, example: '123456', description: 'Demo mode only: the 6-digit reset code.' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'The code must be 6 digits' })
  code?: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsNewPassword()
  newPassword!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  @MaxLength(256)
  token!: string;
}

export class ResendVerificationDto {
  @ApiProperty()
  @IsEmailAddress()
  email!: string;
}
