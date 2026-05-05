import { AuditLogDto, UpdateAuditLogDto } from '../common/base.dto';
import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog>;
    create(dto: AuditLogDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog>;
    update(id: string, dto: UpdateAuditLogDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog>;
    replace(id: string, dto: UpdateAuditLogDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").AuditLog>;
}
