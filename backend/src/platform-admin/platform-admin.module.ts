import { Module } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import {
  PlatformOrganizationsController,
  PlatformAdminTeamController,
  PlatformSettingsController,
} from './platform-admin.controller';

@Module({
  controllers: [PlatformOrganizationsController, PlatformAdminTeamController, PlatformSettingsController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
