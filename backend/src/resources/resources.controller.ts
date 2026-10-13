import { Body, Controller, Get, Param, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth, PlatformAuth } from '../auth/decorators/protected.decorator';
import {
  CurrentUser,
  AuthenticatedPlatformAdmin,
  AuthenticatedOrgUser,
} from '../auth/decorators/current-user.decorator';
import { ResourcesService } from './resources.service';
import { CreateFactorVersionDto, CreateResourceTypeDto } from './dto/resource-type.dto';
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

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List the resource type catalog with compatible units' })
  findAll() {
    return this.service.findAllTypes();
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single resource type with its units' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
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

  @Post('versions/global')
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a global-default emission factor version (Platform Admin)' })
  createGlobalVersion(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: CreateFactorVersionDto) {
    const version = this.service.createFactorVersionGlobal(admin, dto);
    return { message: 'Global emission factor version created.', data: version };
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

  @Get('versions/:resourceTypeId')
  @OrgAuth()
  @ApiOperation({ summary: 'List applicable factor versions for a resource type (org override + global default)' })
  findVersions(@CurrentUser() user: AuthenticatedOrgUser, @Param('resourceTypeId', ParseUUIDPipe) resourceTypeId: string) {
    return this.service.findFactorVersionsForType(resourceTypeId, user.organizationId);
  }
}
