import { Injectable } from '@nestjs/common';
import { AuditLogDto, UpdateAuditLogDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { AuditLog } from '../in-memory/entities';

@Injectable()
export class AuditService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<AuditLog>('auditLogs');
  }

  find(id: string) {
    return this.store.find<AuditLog>('auditLogs', id);
  }

  create(dto: AuditLogDto) {
    return this.store.create<AuditLog>('auditLogs', { id: Date.now(), ...dto } as AuditLog, 'aud');
  }

  update(id: string, dto: UpdateAuditLogDto) {
    return this.store.update<AuditLog>('auditLogs', id, dto as AuditLog);
  }

  remove(id: string) {
    return this.store.remove<AuditLog>('auditLogs', id);
  }
}
