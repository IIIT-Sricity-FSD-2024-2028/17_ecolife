import { Injectable } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLog } from '../database/types';
import { AuditLogQueryDto } from './audit-logs.dto';

/**
 * Read-only view over the audit trail. Writing stays exclusively in
 * AuditLogService (append-only); nothing here can alter an entry.
 */
@Injectable()
export class AuditLogsReadService {
  constructor(private readonly db: DbService) {}

  /** Org Admin: only entries belonging to their own organization. */
  forOrganization(organizationId: string, query: AuditLogQueryDto) {
    return this.search((log) => log.organizationId === organizationId, query, false);
  }

  /** Platform: every entry, optionally narrowed to one organization. */
  forPlatform(query: AuditLogQueryDto) {
    return this.search(
      (log) => (query.organizationId ? log.organizationId === query.organizationId : true),
      query,
      true,
    );
  }

  /** Distinct actions seen so far, to populate a filter dropdown. */
  actionsFor(organizationId?: string): string[] {
    const set = new Set<string>();
    for (const log of this.db.store.auditLogs) {
      if (organizationId && log.organizationId !== organizationId) continue;
      set.add(log.action);
    }
    return [...set].sort();
  }

  private search(scope: (log: AuditLog) => boolean, q: AuditLogQueryDto, includeOrg: boolean) {
    const from = q.from ? new Date(q.from).getTime() : null;
    const to = q.to ? new Date(q.to).getTime() : null;
    const actorNeedle = q.actor?.trim().toLowerCase();

    const rows = this.db.store.auditLogs
      .filter(scope)
      .filter((log) => !q.action || log.action === q.action)
      .filter((log) => !q.entityType || log.entityType === q.entityType)
      .filter((log) => {
        const t = new Date(log.createdAt).getTime();
        return (from === null || t >= from) && (to === null || t <= to);
      })
      .map((log) => this.enrich(log, includeOrg))
      .filter(
        (row) =>
          !actorNeedle ||
          row.actorName.toLowerCase().includes(actorNeedle) ||
          row.actorEmail.toLowerCase().includes(actorNeedle),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    return { total: rows.length, limit, offset, items: rows.slice(offset, offset + limit) };
  }

  private enrich(log: AuditLog, includeOrg: boolean) {
    let actorName = 'System';
    let actorEmail = '';
    let actorType: 'ORG_USER' | 'PLATFORM_ADMIN' | 'SYSTEM' = 'SYSTEM';

    if (log.orgUserId) {
      const u = this.db.store.orgUsers.find((x) => x.id === log.orgUserId);
      actorName = u?.fullName ?? 'Unknown user';
      actorEmail = u?.email ?? '';
      actorType = 'ORG_USER';
    } else if (log.platformAdminId) {
      const a = this.db.store.platformAdmins.find((x) => x.id === log.platformAdminId);
      actorName = a?.fullName ?? 'Unknown admin';
      actorEmail = a?.email ?? '';
      actorType = 'PLATFORM_ADMIN';
    }

    const row: Record<string, any> & { createdAt: string; actorName: string; actorEmail: string } = {
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName,
      actorEmail,
      actorType,
      metadata: log.metadata,
    };

    if (includeOrg) {
      row.organizationId = log.organizationId;
      row.organizationName = log.organizationId
        ? (this.db.store.organizations.find((o) => o.id === log.organizationId)?.name ?? null)
        : null;
    }
    return row;
  }
}
