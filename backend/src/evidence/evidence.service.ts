import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class EvidenceService {
  constructor(private readonly db: DbService, private readonly auditLog: AuditLogService) {}

  validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Accepted: PDF, JPEG, PNG, GIF, WebP, CSV, Excel.`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB size limit.');
    }
  }

  attach(user: AuthenticatedOrgUser, resourceRecordId: string, file: Express.Multer.File) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');

    if (user.role === 'CONTRIBUTOR' && record.createdById !== user.sub) {
      throw new ForbiddenException('You can only attach evidence to your own entries.');
    }
    if (!['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'].includes(record.status)) {
      throw new ForbiddenException('Evidence can only be attached before submission or while changes are requested.');
    }

    const evidence = {
      id: this.db.id(),
      resourceRecordId,
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedById: user.sub,
      uploadedAt: this.db.now(),
    };
    this.db.store.evidence.push(evidence);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'evidence.uploaded',
      entityType: 'evidence',
      entityId: evidence.id,
      metadata: { resourceRecordId, fileName: file.originalname },
    });

    return evidence;
  }

  findForRecord(user: AuthenticatedOrgUser, resourceRecordId: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');

    return this.db.store.evidence
      .filter((e) => e.resourceRecordId === resourceRecordId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  }
}
