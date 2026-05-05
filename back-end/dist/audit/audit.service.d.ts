import { AuditLogDto, UpdateAuditLogDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { AuditLog } from '../in-memory/entities';
export declare class AuditService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): AuditLog[];
    find(id: string): AuditLog;
    create(dto: AuditLogDto): AuditLog;
    update(id: string, dto: UpdateAuditLogDto): AuditLog;
    remove(id: string): AuditLog;
}
