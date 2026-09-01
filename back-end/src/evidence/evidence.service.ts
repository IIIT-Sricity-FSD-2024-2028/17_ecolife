import { Injectable } from '@nestjs/common';
import { EvidenceDto, UpdateEvidenceDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Evidence } from '../in-memory/entities';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly store: InMemoryStoreService,
    private readonly revenueService: RevenueService,
  ) {}

  list() { return this.store.list<Evidence>('evidences'); }
  find(id: string) { return this.store.find<Evidence>('evidences', id); }
  create(dto: EvidenceDto) {
    if (dto.submissionId) {
      const db = this.store.snapshot();
      const sub = db.submissions.find(s => s.id === dto.submissionId);
      if (sub && sub.organizationId) {
        this.revenueService.checkStorageLimit(sub.organizationId, dto.fileSizeBytes || 0);
      }
    }
    return this.store.create<Evidence>('evidences', { status: 'Uploaded', extractedFields: {}, createdAt: new Date().toISOString(), ...dto } as Evidence, 'ev');
  }
  update(id: string, dto: UpdateEvidenceDto) { return this.store.update<Evidence>('evidences', id, dto as Evidence); }
  remove(id: string) { return this.store.remove<Evidence>('evidences', id); }
}
