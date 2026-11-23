import { Module } from '@nestjs/common';
import { EvidenceController, EvidenceService } from './evidence.controller';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService]
})
export class EvidenceModule {}
