import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileService } from './profile.service';
import { OrgProfileController, PlatformProfileController } from './profile.controller';

@Module({
  imports: [AuthModule],
  controllers: [OrgProfileController, PlatformProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
