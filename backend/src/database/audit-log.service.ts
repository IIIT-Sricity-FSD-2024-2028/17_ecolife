import { Injectable } from '@nestjs/common';
import { DbService } from './db.service';

interface AuditEntry {
  organizationId?: string | null;
  orgUserId?: string | null;
  platformAdminId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only writer for the audit log. There is deliberately no update or
 * delete method here — nothing in the codebase should ever alter a
 * historical audit entry.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly db: DbService) {}

  log(entry: AuditEntry): void {
    this.db.store.auditLogs.push({
      id: this.db.id(),
      organizationId: entry.organizationId ?? null,
      orgUserId: entry.orgUserId ?? null,
      platformAdminId: entry.platformAdminId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? null,
      createdAt: this.db.now(),
    });
    this.db.persist();
  }
}
