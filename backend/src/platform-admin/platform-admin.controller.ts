import { Body, Controller, Delete, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { PlatformAdminService } from './platform-admin.service';
import { InvitePlatformAdminDto, UpdateOrgStatusDto, UpdatePlatformSettingsDto } from './dto/platform-admin.dto';

@ApiTags('Platform Admin — Organizations')
@Controller('platform/organizations')
export class PlatformOrganizationsController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List all organizations on the platform' })
  findAll() {
    return this.service.listOrganizations();
  }

  @Get(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get a single organization' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getOrganization(id);
  }

  @Patch(':id/status')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: "Suspend, reactivate, or change an organization's status" })
  updateStatus(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrgStatusDto,
  ) {
    const org = this.service.updateOrgStatus(admin, id, dto);
    return { message: `Organization status updated to ${dto.status}.`, data: org };
  }
}

@ApiTags('Platform Admin — Admin Team')
@Controller('platform/admins')
export class PlatformAdminTeamController {
  constructor(private readonly service: PlatformAdminService) {}

  @Post()
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Invite a new Platform Admin or Super Admin (Super Admin only)' })
  async invite(@CurrentUser() actor: AuthenticatedPlatformAdmin, @Body() dto: InvitePlatformAdminDto) {
    const admin = await this.service.inviteAdmin(actor, dto);
    return { message: 'Admin invited.', data: admin };
  }

  @Get()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List the admin team' })
  findAll() {
    return this.service.listAdmins();
  }

  @Delete(':id')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate an admin (Super Admin only)' })
  remove(@CurrentUser() actor: AuthenticatedPlatformAdmin, @Param('id', ParseUUIDPipe) id: string) {
    const result = this.service.removeAdmin(actor, id);
    return { message: 'Admin deactivated.', data: result };
  }
}

@ApiTags('Platform Admin — Settings')
@Controller('platform/settings')
export class PlatformSettingsController {
  constructor(private readonly service: PlatformAdminService) {}

  @Get()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get platform-wide settings' })
  get() {
    return this.service.getSettings();
  }

  @Patch()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update maintenance mode / default session timeout' })
  update(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: UpdatePlatformSettingsDto) {
    const settings = this.service.updateSettings(admin, dto);
    return { message: 'Settings updated.', data: settings };
  }
}
