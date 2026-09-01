import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RevenueModule } from '../revenue/revenue.module';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

@Module({
  imports: [CommonModule, RevenueModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
})
export class EvidenceModule {}
