import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { OrgProfileController, PlatformProfileController } from './profile.controller';

@Module({
  controllers: [OrgProfileController, PlatformProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
