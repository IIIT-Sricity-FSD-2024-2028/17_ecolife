import { EntryStatus, Prisma } from '../../generated/prisma';
import { notifyFromAudit } from './notify.util';

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }
) {
  const row = await tx.auditLog.create({
    data: {
      organizationId: params.organizationId,
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress
    }
  });
  await notifyFromAudit(tx, params);
  return row;
}

export async function writeEntryHistory(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    entryId: string;
    actorId: string;
    action: string;
    fromStatus?: EntryStatus;
    toStatus?: EntryStatus;
    diffJson?: Record<string, unknown>;
  }
) {
  const row = await tx.entryHistory.create({
    data: {
      organizationId: params.organizationId,
      entryId: params.entryId,
      actorId: params.actorId,
      action: params.action,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      diffJson: (params.diffJson ?? {}) as Prisma.InputJsonValue
    }
  });
  if (params.action === 'SUBMITTED') await notifyFromAudit(tx, { organizationId: params.organizationId, actorId: params.actorId, action: 'ENTRY_SUBMITTED', resourceType: 'ResourceEntry', resourceId: params.entryId });
  return row;
}
