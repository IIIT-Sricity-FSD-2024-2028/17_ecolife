import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgAuth, PlatformAuth } from '../auth/decorators/protected.decorator';
import {
  AuthenticatedOrgUser,
  AuthenticatedPlatformAdmin,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto';

@ApiTags('Profile')
@Controller('me')
export class OrgProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'Get your own profile (any org role)' })
  get(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.getOrgProfile(user);
  }

  @Patch()
  @OrgAuth()
  @ApiOperation({ summary: 'Update your own name / phone. Email and role cannot be changed here.' })
  update(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: UpdateProfileDto) {
    return { message: 'Profile updated.', data: this.service.updateOrgProfile(user, dto) };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @OrgAuth()
  @ApiOperation({ summary: 'Change your own password (requires the current password)' })
  async changePassword(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: ChangePasswordDto) {
    const data = await this.service.changeOrgPassword(user, dto);
    return { message: 'Password changed.', data };
  }
}

@ApiTags('Profile')
@Controller('platform/me')
export class PlatformProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Get your own admin profile' })
  get(@CurrentUser() admin: AuthenticatedPlatformAdmin) {
    return this.service.getAdminProfile(admin);
  }

  @Patch()
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Update your own name / phone' })
  update(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: UpdateProfileDto) {
    return { message: 'Profile updated.', data: this.service.updateAdminProfile(admin, dto) };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @PlatformAuth('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Change your own password (requires the current password)' })
  async changePassword(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: ChangePasswordDto) {
    const data = await this.service.changeAdminPassword(admin, dto);
    return { message: 'Password changed.', data };
  }
}
