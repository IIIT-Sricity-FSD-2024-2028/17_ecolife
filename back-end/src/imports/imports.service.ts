import { Injectable } from '@nestjs/common';
import { ImportBatchDto, UpdateImportBatchDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { ImportBatch, ImportError } from '../in-memory/entities';

@Injectable()
export class ImportsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() { return this.store.list<ImportBatch>('importBatches'); }
  errors() { return this.store.list<ImportError>('importErrors'); }
  find(id: string) { return this.store.find<ImportBatch>('importBatches', id); }
  create(dto: ImportBatchDto) {
    return this.store.createImportBatch(dto as ImportBatch & { rows?: any[] });
  }
  update(id: string, dto: UpdateImportBatchDto) { return this.store.update<ImportBatch>('importBatches', id, dto as ImportBatch); }
  remove(id: string) { return this.store.remove<ImportBatch>('importBatches', id); }
}
