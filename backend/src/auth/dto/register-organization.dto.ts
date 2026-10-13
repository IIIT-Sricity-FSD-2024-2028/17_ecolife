import { ApiProperty } from '@nestjs/swagger';
import { IsEmailAddress, IsNewPassword, RequiredText } from '../../common/validation/validators';

export class RegisterOrganizationDto {
  @ApiProperty({ example: 'Acme Industries' })
  @RequiredText(120, 'Organization name is required')
  organizationName!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @RequiredText(120, 'Your full name is required')
  fullName!: string;

  @ApiProperty({ example: 'jane@acme.com' })
  @IsEmailAddress()
  email!: string;

  @ApiProperty({ example: 'StrongPass1!' })
  @IsNewPassword()
  password!: string;
}
