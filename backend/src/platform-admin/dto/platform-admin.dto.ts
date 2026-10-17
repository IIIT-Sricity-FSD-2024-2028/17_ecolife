import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';
import { IsEmailAddress, IsNewPassword, OptionalText, RequiredText } from '../../common/validation/validators';

export class InvitePlatformAdminDto {
  @ApiProperty()
  @IsEmailAddress()
  email!: string;

  @ApiProperty()
  @RequiredText(120, 'Full name is required')
  fullName!: string;

  @ApiProperty({ enum: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] })
  @IsIn(['SUPER_ADMIN', 'PLATFORM_ADMIN'], { message: 'Role must be SUPER_ADMIN or PLATFORM_ADMIN' })
  role!: string;

  @ApiProperty({ description: 'Initial password. Same strength rules as any password.' })
  @IsNewPassword()
  temporaryPassword!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(50)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(100)
  jobTitle?: string;
}

export class UpdatePlatformAdminDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmailAddress()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Full name cannot be empty')
  fullName?: string;

  @ApiProperty({ enum: ['SUPER_ADMIN', 'PLATFORM_ADMIN'], required: false })
  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'PLATFORM_ADMIN'], { message: 'Role must be SUPER_ADMIN or PLATFORM_ADMIN' })
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Optional new temporary password' })
  @IsOptional()
  @IsNewPassword()
  temporaryPassword?: string;

  @ApiProperty({ required: false, description: 'Reset failed logins and unlock' })
  @IsOptional()
  @IsBoolean()
  unlock?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(50)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(100)
  jobTitle?: string;
}

export class UpdateOrgStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'TRIAL'] })
  @IsIn(['ACTIVE', 'SUSPENDED', 'TRIAL'], { message: 'Status must be ACTIVE, SUSPENDED or TRIAL' })
  status!: string;

  @ApiProperty({ required: false, description: 'Why the status is changing. Required when suspending.' })
  @OptionalText(500)
  reason?: string;
}

export class UpdatePlatformSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean({ message: 'maintenanceMode must be true or false' })
  maintenanceMode?: boolean;

  @ApiProperty({ required: false, description: 'Shown to users while maintenance mode is on.' })
  @OptionalText(500)
  maintenanceMessage?: string;

  @ApiProperty({ required: false, description: 'Minutes of inactivity before a session expires (5–1440).' })
  @IsOptional()
  @IsInt({ message: 'Session timeout must be a whole number of minutes' })
  @Min(5, { message: 'Session timeout must be at least 5 minutes' })
  @Max(1440, { message: 'Session timeout must be at most 1440 minutes (24 hours)' })
  defaultSessionTimeoutMin?: number;

  @ApiProperty({ required: false, description: 'Failed sign-ins in a row before an account is locked (3–20).' })
  @IsOptional()
  @IsInt({ message: 'Failed attempts must be a whole number' })
  @Min(3, { message: 'Allow at least 3 failed attempts' })
  @Max(20, { message: 'Allow at most 20 failed attempts' })
  maxFailedLogins?: number;

  @ApiProperty({ required: false, description: 'Minutes an account stays locked (1–1440).' })
  @IsOptional()
  @IsInt({ message: 'Lockout time must be a whole number of minutes' })
  @Min(1, { message: 'Lockout must be at least 1 minute' })
  @Max(1440, { message: 'Lockout must be at most 1440 minutes (24 hours)' })
  lockoutMinutes?: number;

  @ApiProperty({ required: false, description: 'Allow new organizations to register themselves.' })
  @IsOptional()
  @IsBoolean({ message: 'allowRegistration must be true or false' })
  allowRegistration?: boolean;

  @ApiProperty({ required: false, description: 'Require a work email when registering.' })
  @IsOptional()
  @IsBoolean({ message: 'requireWorkEmail must be true or false' })
  requireWorkEmail?: boolean;
}

export class CreateFactorSourceDto {
  @ApiProperty({ example: 'DEFRA 2026 Conversion Factors' })
  @RequiredText(200, 'Source name is required')
  name!: string;

  @ApiProperty({ example: 'UK Government' })
  @RequiredText(200, 'Publisher is required')
  publisher!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(500)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Reference must be a valid http(s) URL' })
  referenceUrl?: string;
}

export class UpdateFactorSourceDto {
  @ApiProperty({ required: false, example: 'DEFRA 2026 Conversion Factors (Updated)' })
  @IsOptional()
  @RequiredText(200, 'Source name cannot be empty')
  name?: string;

  @ApiProperty({ required: false, example: 'UK Government' })
  @IsOptional()
  @RequiredText(200, 'Publisher cannot be empty')
  publisher?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(500)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Reference must be a valid http(s) URL' })
  referenceUrl?: string | null;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @RequiredText(150, 'Organization name is required')
  name!: string;

  @ApiProperty({ example: 'John Owner' })
  @RequiredText(120, 'Owner full name is required')
  ownerName!: string;

  @ApiProperty({ example: 'owner@acme.com' })
  @IsEmailAddress()
  ownerEmail!: string;

  @ApiProperty({ required: false, description: 'Optional initial password. Defaults to Welcome123! if omitted.' })
  @IsOptional()
  @IsNewPassword()
  password?: string;

  @ApiProperty({ required: false, description: 'Plan ID to assign' })
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false, example: 2024 })
  @IsOptional()
  @IsInt({ message: 'Baseline year must be an integer' })
  @Min(1990)
  @Max(2050)
  baselineYear?: number;

  @ApiProperty({ required: false, example: 'USD' })
  @IsOptional()
  @OptionalText(5)
  currency?: string;

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  carbonPricePerTon?: number;
}

export class UpdateOrganizationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(150, 'Organization name cannot be empty')
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt({ message: 'Baseline year must be an integer' })
  @Min(1990)
  @Max(2050)
  baselineYear?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @OptionalText(5)
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  carbonPricePerTon?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt({ message: 'Session timeout must be an integer' })
  @Min(5)
  @Max(1440)
  sessionTimeoutOverrideMin?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;
}

export class AdminCreateDepartmentDto {
  @ApiProperty({ example: 'Facilities & Fleet' })
  @RequiredText(120, 'Department name is required')
  name!: string;

  @ApiProperty({ required: false })
  @OptionalText(500)
  description?: string;
}

export class AdminUpdateDepartmentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Department name cannot be empty')
  name?: string;

  @ApiProperty({ required: false })
  @OptionalText(500)
  description?: string;
}

export class AdminCreateOrgUserDto {
  @ApiProperty({ example: 'user@acme.com' })
  @IsEmailAddress()
  email!: string;

  @ApiProperty({ example: 'Jane Doe' })
  @RequiredText(120, 'Full name is required')
  fullName!: string;

  @ApiProperty({ enum: ['ORG_ADMIN', 'REVIEWER', 'CONTRIBUTOR', 'EXECUTIVE'] })
  @IsIn(['ORG_ADMIN', 'REVIEWER', 'CONTRIBUTOR', 'EXECUTIVE'], { message: 'Valid role required' })
  role!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false, description: 'Optional initial password. Defaults to Welcome123! if omitted.' })
  @IsOptional()
  @IsNewPassword()
  temporaryPassword?: string;
}

export class AdminUpdateOrgUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @RequiredText(120, 'Full name cannot be empty')
  fullName?: string;

  @ApiProperty({ required: false, enum: ['ORG_ADMIN', 'REVIEWER', 'CONTRIBUTOR', 'EXECUTIVE'] })
  @IsOptional()
  @IsIn(['ORG_ADMIN', 'REVIEWER', 'CONTRIBUTOR', 'EXECUTIVE'], { message: 'Valid role required' })
  role?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  departmentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
