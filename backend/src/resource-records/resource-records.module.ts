import { Module } from '@nestjs/common';
import { ResourceRecordsService } from './resource-records.service';
import { ResourceRecordsController } from './resource-records.controller';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { ResourcesModule } from '../resources/resources.module';
import { CalculationsModule } from '../calculations/calculations.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [ResourcesModule, CalculationsModule, EvidenceModule],
  controllers: [ResourceRecordsController, TargetsController],
  providers: [ResourceRecordsService, TargetsService],
  exports: [ResourceRecordsService, TargetsService],
})
export class ResourceRecordsModule {}
