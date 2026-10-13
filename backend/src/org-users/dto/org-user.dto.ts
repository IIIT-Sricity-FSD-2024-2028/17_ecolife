import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { IsEmailAddress, IsNewPassword, RequiredText } from '../../common/validation/validators';

const INVITABLE_ROLES = ['ORG_ADMIN', 'CONTRIBUTOR', 'REVIEWER', 'EXECUTIVE'];

export class InviteOrgUserDto {
  @ApiProperty({ example: 'new.person@acme.com' })
  @IsEmailAddress()
  email!: string;

  @ApiProperty({ example: 'New Person' })
  @RequiredText(120, 'Full name is required')
  fullName!: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsIn(INVITABLE_ROLES, { message: 'Role must be one of: ' + INVITABLE_ROLES.join(', ') })
  role!: string;

  @ApiProperty({
    required: false,
    description: 'Required when role is CONTRIBUTOR — a Contributor belongs to exactly one department.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @ApiProperty({ description: 'Initial password the new user signs in with. Same strength rules as any password.' })
  @IsNewPassword()
  temporaryPassword!: string;
}

export class UpdateOrgUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Full name cannot be empty')
  fullName?: string;

  @ApiProperty({ required: false, enum: INVITABLE_ROLES })
  @IsOptional()
  @IsIn(INVITABLE_ROLES, { message: 'Role must be one of: ' + INVITABLE_ROLES.join(', ') })
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
