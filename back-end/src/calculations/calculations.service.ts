import { Injectable } from '@nestjs/common';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { ImpactCalculation, ImpactResult } from '../in-memory/entities';

@Injectable()
export class CalculationsService {
  constructor(private readonly store: InMemoryStoreService) {}

  calculations() { return this.store.list<ImpactCalculation>('impactCalculations'); }
  results() { return this.store.list<ImpactResult>('impactResults'); }
  recalculateRecord(recordId: string) { return this.store.recalculateRecord(recordId); }
}
