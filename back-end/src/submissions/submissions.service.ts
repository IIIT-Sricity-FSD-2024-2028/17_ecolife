import { BadRequestException, Injectable } from '@nestjs/common';
import { SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Submission } from '../in-memory/entities';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly store: InMemoryStoreService,
    private readonly revenueService: RevenueService,
  ) {}

  list() {
    return this.store.list<Submission>('submissions');
  }

  find(id: string) {
    return this.store.find<Submission>('submissions', id);
  }

  create(dto: SubmissionDto) {
    if (dto.organizationId) {
      this.revenueService.checkLimit(dto.organizationId, 'submissions');
    }
    return this.store.lockSubmission(dto as Submission);
  }

  update(id: string, dto: UpdateSubmissionDto) {
    const existing = this.store.find<Submission>('submissions', id);
    if (existing) {
      if (dto.status && dto.status !== existing.status) {
        throw new BadRequestException('Submission status cannot be changed directly via update. Use explicit workflow endpoints (/approve, /request-correction, /resubmit).');
      }
      if (dto.locked !== undefined && dto.locked !== existing.locked) {
        throw new BadRequestException('Submission lock state cannot be changed directly via update. Use explicit workflow endpoints.');
      }
    }
    return this.store.update<Submission>('submissions', id, dto as Submission);
  }

  approve(id: string, approvedBy?: string) {
    return this.store.approveSubmission(id, approvedBy);
  }

  requestCorrection(id: string, comment: string, requestedBy?: string) {
    return this.store.requestSubmissionCorrection(id, comment, requestedBy);
  }

  resubmit(id: string, notes?: string) {
    return this.store.resubmitSubmission(id, notes);
  }

  remove(id: string) {
    return this.store.remove<Submission>('submissions', id);
  }
}
