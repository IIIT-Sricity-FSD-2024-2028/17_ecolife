import { Injectable } from '@nestjs/common';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { RorizonDb } from '../in-memory/entities';

@Injectable()
export class SyncService {
  constructor(private readonly store: InMemoryStoreService) {}

  snapshot() {
    return this.store.snapshot();
  }

  replace(snapshot: Partial<RorizonDb>) {
    return this.store.replace(snapshot);
  }
}
