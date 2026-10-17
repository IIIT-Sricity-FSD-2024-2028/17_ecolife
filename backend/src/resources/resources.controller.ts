import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth, PlatformAuth } from '../auth/decorators/protected.decorator';
import {
  CurrentUser,
  AuthenticatedPlatformAdmin,
  AuthenticatedOrgUser,
} from '../auth/decorators/current-user.decorator';
import { ResourcesService } from './resources.service';
import {
  CreateFactorVersionDto,
  CreateResourceTypeDto,
  UpdateFactorSourceDto,
  UpdateFactorVersionDto,
  UpdateResourceTypeDto,
} from './dto/resource-type.dto';
import { CreateFactorSourceDto } from '../platform-admin/dto/platform-admin.dto';

@ApiTags('Resource Types')
@Controller('resource-types')
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Post()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a resource type + its compatible units (Platform Admin)' })
  create(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: CreateResourceTypeDto) {
    const type = this.service.createType(admin, dto);
    return { message: 'Resource type created.', data: type };
  }

  @Patch(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a resource type + units or status (Platform Admin)' })
  update(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateResourceTypeDto,
  ) {
    const type = this.service.updateType(admin, id, dto);
    return { message: 'Resource type updated.', data: type };
  }

  @Delete(':id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete or retire a resource type (Platform Admin)' })
  delete(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Param('id') id: string) {
    return this.service.deleteType(admin, id);
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List the resource type catalog with compatible units' })
  findAll() {
    return this.service.findAllTypes();
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single resource type with its units' })
  findOne(@Param('id') id: string) {
    return this.service.findOneType(id);
  }
}

@ApiTags('Emission Factors')
@Controller('factors')
export class FactorsController {
  constructor(private readonly service: ResourcesService) {}

  @Get('sources')
  @OrgAuth()
  @ApiOperation({ summary: 'List emission factor sources' })
  findSources() {
    return this.service.findAllSources();
  }

  @Post('sources')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create an emission factor source (Platform Admin)' })
  createSource(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Body() dto: CreateFactorSourceDto,
  ) {
    const source = this.service.createSource(admin, dto.name, dto.publisher, dto.referenceUrl);
    return { message: 'Factor source created.', data: source };
  }

  @Patch('sources/:id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an emission factor source (Platform Admin)' })
  updateSource(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateFactorSourceDto,
  ) {
    const source = this.service.updateSource(admin, id, dto);
    return { message: 'Factor source updated.', data: source };
  }

  @Delete('sources/:id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete an emission factor source (Platform Admin)' })
  deleteSource(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
  ) {
    return this.service.deleteSource(admin, id);
  }

  @Post('versions/global')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a global-default emission factor version (Platform Admin)' })
  createGlobalVersion(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: CreateFactorVersionDto) {
    const version = this.service.createFactorVersionGlobal(admin, dto);
    return { message: 'Global emission factor version created.', data: version };
  }

  @Patch('versions/:id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an emission factor version (Platform Admin)' })
  updateVersion(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateFactorVersionDto,
  ) {
    const version = this.service.updateFactorVersion(admin, id, dto);
    return { message: 'Emission factor version updated.', data: version };
  }

  @Delete('versions/:id')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete an emission factor version (Platform Admin)' })
  deleteVersion(
    @CurrentUser() admin: AuthenticatedPlatformAdmin,
    @Param('id') id: string,
  ) {
    return this.service.deleteFactorVersion(admin, id);
  }

  @Post('versions/override')
  @OrgAuth('REVIEWER')
  @ApiOperation({
    summary: "Create an org-specific emission factor override (Reviewer)",
    description: 'Reviewer owns methodology and factor overrides per the current role split.',
  })
  createOverrideVersion(@CurrentUser() reviewer: AuthenticatedOrgUser, @Body() dto: CreateFactorVersionDto) {
    const version = this.service.createFactorVersionOverride(reviewer, dto);
    return { message: 'Org factor override created.', data: version };
  }

  @Get('versions')
  @OrgAuth()
  @ApiOperation({ summary: 'List applicable factor versions for all resource types (org override + global default)' })
  findAllVersions(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAllFactorVersions(user.organizationId);
  }

  @Get('versions/:resourceTypeId')
  @OrgAuth()
  @ApiOperation({ summary: 'List applicable factor versions for a resource type (org override + global default)' })
  findVersions(@CurrentUser() user: AuthenticatedOrgUser, @Param('resourceTypeId') resourceTypeId: string) {
    return this.service.findFactorVersionsForType(resourceTypeId, user.organizationId);
  }
}
