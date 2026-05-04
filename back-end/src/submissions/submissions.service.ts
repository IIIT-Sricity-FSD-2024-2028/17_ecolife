import { Injectable } from '@nestjs/common';
import { SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Submission } from '../in-memory/entities';

@Injectable()
export class SubmissionsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<Submission>('submissions');
  }

  find(id: string) {
    return this.store.find<Submission>('submissions', id);
  }

  create(dto: SubmissionDto) {
    return this.store.lockSubmission(dto as Submission);
  }

  update(id: string, dto: UpdateSubmissionDto) {
    return this.store.update<Submission>('submissions', id, dto as Submission);
  }

  remove(id: string) {
    return this.store.remove<Submission>('submissions', id);
  }
}
