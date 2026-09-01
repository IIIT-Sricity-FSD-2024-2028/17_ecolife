import { Injectable } from '@nestjs/common';
import { ResourceRecordDto, UpdateResourceRecordDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { ResourceRecord } from '../in-memory/entities';

@Injectable()
export class ResourceRecordsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() { return this.store.list<ResourceRecord>('resourceRecords'); }
  find(id: string) { return this.store.find<ResourceRecord>('resourceRecords', id); }
  create(dto: ResourceRecordDto) { return this.store.createResourceRecord(dto as ResourceRecord); }
  update(id: string, dto: UpdateResourceRecordDto) { return this.store.update<ResourceRecord>('resourceRecords', id, dto as ResourceRecord); }
  remove(id: string) { return this.store.removeResourceRecord(id); }
}
