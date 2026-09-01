import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ResourceRecordsController } from './resource-records.controller';
import { ResourceRecordsService } from './resource-records.service';

@Module({
  imports: [CommonModule],
  controllers: [ResourceRecordsController],
  providers: [ResourceRecordsService],
})
export class ResourceRecordsModule {}
