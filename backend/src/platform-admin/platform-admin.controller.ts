import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedPlatformAdmin } from '../auth/decorators/current-user.decorator';
import { PlatformAdminService } from './platform-admin.service';
import {
  AdminCreateDepartmentDto,
  AdminCreateOrgUserDto,
  AdminUpdateDepartmentDto,
  AdminUpdateOrgUserDto,
  CreateOrganizationDto,
  InvitePlatformAdminDto,
  UpdatePlatformAdminDto,
  UpdateOrganizationDto,
  UpdateOrgStatusDto,
  UpdatePlatformSettingsDto,
} from './dto/platform-admin.dto';

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

  @Post()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Provision a new organization with initial owner' })
  async create(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: CreateOrganizationDto) {
    const result = await this.service.createOrganization(admin, dto);
    return { message: 'Organization created successfully.', data: result };
  }

  @Get(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get a single organization' })
  findOne(@Param('id') id: string) {
    return this.service.getOrganization(id);
  }

  @Patch(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update organization settings, plan, currency, or timeout' })
  update(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const org = this.service.updateOrganization(admin, id, dto);
    return { message: 'Organization updated.', data: org };
  }

  @Delete(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete organization with 30-day retention recovery window' })
  remove(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const result = this.service.deleteOrganization(admin, id);
    return { message: 'Organization scheduled for deletion (30-day recovery window).', data: result };
  }

  @Post(':id/restore')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Restore a soft-deleted organization within its 30-day recovery window' })
  restore(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const org = this.service.restoreOrganization(admin, id);
    return { message: 'Organization restored successfully.', data: org };
  }

  @Delete(':id/purge')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Permanently purge organization and all data immediately (Super Admin only)' })
  purge(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const result = this.service.purgeOrganization(admin, id);
    return { message: 'Organization permanently purged.', data: result };
  }

  @Patch(':id/status')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: "Suspend, reactivate, or change an organization's status" })
  updateStatus(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateOrgStatusDto,
  ) {
    const org = this.service.updateOrgStatus(admin, id, dto);
    return { message: `Organization status updated to ${dto.status}.`, data: org };
  }

  // ---------------------------------------------------------------------
  // Department Management (Admin Scoped)
  // ---------------------------------------------------------------------
  @Get(':id/departments')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List departments for an organization' })
  listDepartments(@Param('id') id: string) {
    return this.service.listOrgDepartments(id);
  }

  @Post(':id/departments')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new department in an organization' })
  createDepartment(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: AdminCreateDepartmentDto,
  ) {
    const dept = this.service.createOrgDepartment(admin, id, dto);
    return { message: 'Department created successfully.', data: dept };
  }

  @Patch(':id/departments/:deptId')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a department in an organization' })
  updateDepartment(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Param('deptId') deptId: string,
    @Body() dto: AdminUpdateDepartmentDto,
  ) {
    const dept = this.service.updateOrgDepartment(admin, id, deptId, dto);
    return { message: 'Department updated.', data: dept };
  }

  @Delete(':id/departments/:deptId')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a department in an organization' })
  deleteDepartment(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Param('deptId') deptId: string,
  ) {
    const result = this.service.deleteOrgDepartment(admin, id, deptId);
    return { message: 'Department deleted.', data: result };
  }

  // ---------------------------------------------------------------------
  // Organization Users Management (Admin Scoped)
  // ---------------------------------------------------------------------
  @Get(':id/users')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List users in an organization' })
  listUsers(@Param('id') id: string) {
    return this.service.listOrgUsers(id);
  }

  @Post(':id/users')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Add a new user directly to an organization' })
  async createUser(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: AdminCreateOrgUserDto,
  ) {
    const user = await this.service.createOrgUser(admin, id, dto);
    return { message: 'User created successfully.', data: user };
  }

  @Patch(':id/users/:userId')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an organization user (role, department, active status)' })
  updateUser(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: AdminUpdateOrgUserDto,
  ) {
    const user = this.service.updateOrgUser(admin, id, userId, dto);
    return { message: 'User updated.', data: user };
  }

  @Delete(':id/users/:userId')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate an organization user' })
  deactivateUser(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const result = this.service.deactivateOrgUser(admin, id, userId);
    return { message: 'User deactivated.', data: result };
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
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'List the admin team (Super Admin only)' })
  findAll() {
    return this.service.listAdmins();
  }

  @Get(':id')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get an admin by id (Super Admin only)' })
  findOne(@Param('id') id: string) {
    return this.service.getAdmin(id);
  }

  @Patch(':id')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an admin (Super Admin only)' })
  async update(
    @CurrentUser() actor: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformAdminDto,
  ) {
    const admin = await this.service.updateAdmin(actor, id, dto);
    return { message: 'Admin updated.', data: admin };
  }

  @Delete(':id')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Deactivate / delete an admin (Super Admin only)' })
  remove(@CurrentUser() actor: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const result = this.service.removeAdmin(actor, id);
    return { message: 'Admin deactivated.', data: result };
  }

  @Post(':id/restore')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Restore an admin (Super Admin only)' })
  restore(@CurrentUser() actor: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const admin = this.service.restoreAdmin(actor, id);
    return { message: 'Admin restored.', data: admin };
  }

  @Delete(':id/purge')
  @PlatformAuth('SUPER_ADMIN')
  @ApiOperation({ summary: 'Permanently purge an admin (Super Admin only)' })
  purge(@CurrentUser() actor: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    const result = this.service.purgeAdmin(actor, id);
    return { message: 'Admin permanently purged.', data: result };
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
