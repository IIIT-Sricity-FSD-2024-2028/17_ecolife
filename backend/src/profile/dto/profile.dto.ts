import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNewPassword, OptionalText, RequiredText, trimValue } from '../../common/validation/validators';

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Full name cannot be empty')
  fullName?: string;

  @ApiProperty({ required: false, description: 'Send an empty string to clear the phone number.' })
  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(30)
  @Matches(/^[+()\-\s\d]*$/, { message: 'Phone number may only contain digits, spaces, + ( ) and -' })
  phone?: string;

  @ApiProperty({ required: false, description: 'Send an empty string to clear the job title.' })
  @OptionalText(80)
  jobTitle?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewStrongPass1!' })
  @IsNewPassword()
  newPassword!: string;
}
