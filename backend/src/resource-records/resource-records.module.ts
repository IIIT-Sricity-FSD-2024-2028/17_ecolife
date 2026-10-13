import { Module } from '@nestjs/common';
import { ResourceRecordsService } from './resource-records.service';
import { ResourceRecordsController } from './resource-records.controller';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { ResourcesModule } from '../resources/resources.module';
import { CalculationsModule } from '../calculations/calculations.module';

@Module({
  imports: [ResourcesModule, CalculationsModule],
  controllers: [ResourceRecordsController, TargetsController],
  providers: [ResourceRecordsService, TargetsService],
  exports: [ResourceRecordsService, TargetsService],
})
export class ResourceRecordsModule {}
