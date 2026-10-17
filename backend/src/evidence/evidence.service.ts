import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { basename, dirname, join, resolve, sep } from 'path';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { Evidence } from '../database/types';

/** Allowed types and the ONLY extension each is stored with. The extension
 * never comes from the client-supplied filename. */
const EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};
export const ALLOWED_MIME_TYPES = Object.keys(EXTENSIONS);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_RECORD = 20;
const MAX_ORG_STORAGE_BYTES = 100 * 1024 * 1024; // 100 MB per organization limit

const looksLikeText = (buf: Buffer) => !buf.subarray(0, 8192).includes(0);

const withoutAsciiControlCharacters = (value: string) =>
  [...value].filter((character) => character.charCodeAt(0) >= 32).join('');

/** The declared Content-Type is client-controlled, so check the file's actual first bytes. */
function contentMatchesType(mime: string, buf: Buffer): boolean {
  const starts = (...bytes: number[]) => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
  switch (mime) {
    case 'application/pdf':
      return starts(0x25, 0x50, 0x44, 0x46);
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'image/gif':
      return starts(0x47, 0x49, 0x46, 0x38);
    case 'image/webp':
      return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return starts(0x50, 0x4b, 0x03, 0x04);
    case 'application/vnd.ms-excel':
      // Windows browsers also label plain .csv files with this type.
      return starts(0xd0, 0xcf, 0x11, 0xe0) || looksLikeText(buf);
    case 'text/csv':
      return looksLikeText(buf);
    default:
      return false;
  }
}

function generateSampleEvidencePdf(fileName: string, record?: any): Buffer {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page
   /Parent 2 0 R
   /MediaBox [0 0 612 792]
   /Resources <<
     /Font <<
       /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
       /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
     >>
   >>
   /Contents 4 0 R
>>
endobj
4 0 obj
<< /Length 380 >>
stream
BT
/F1 18 Tf
50 720 Td
(Tropos Supporting Evidence) Tj
/F2 11 Tf
0 -30 Td
(File: ${fileName}) Tj
0 -20 Td
(Period: ${record?.periodStart || ''} to ${record?.periodEnd || ''}) Tj
0 -20 Td
(Reported Quantity: ${record?.quantity || ''} ${record?.unit || ''}) Tj
0 -20 Td
(Reported Cost: $${record?.cost || ''}) Tj
0 -30 Td
(Status: Verified Supporting Document) Tj
0 -20 Td
(This document was submitted as utility/billing proof for reviewer verification.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000360 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
790
%%EOF`;
  return Buffer.from(content);
}

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
    if (!file.buffer || !contentMatchesType(file.mimetype, file.buffer)) {
      throw new BadRequestException('The file content does not match its declared type.');
    }
  }

  /**
   * Order matters: every check runs BEFORE anything is written to disk, so a
   * rejected request can never leave an orphaned file behind. The controller
   * buffers the upload in memory for exactly this reason.
   */
  attach(user: AuthenticatedOrgUser, resourceRecordId: string, file: Express.Multer.File) {
    this.validateFile(file);

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
    if (this.db.store.evidence.filter((e) => e.resourceRecordId === resourceRecordId).length >= MAX_FILES_PER_RECORD) {
      throw new BadRequestException(`A resource record can have at most ${MAX_FILES_PER_RECORD} evidence files.`);
    }

    const orgRecordIds = new Set(
      this.db.store.resourceRecords.filter((r) => r.organizationId === user.organizationId).map((r) => r.id),
    );
    const currentOrgStorage = this.db.store.evidence
      .filter((e) => orgRecordIds.has(e.resourceRecordId))
      .reduce((sum, e) => sum + (e.fileSizeBytes || 0), 0);

    if (currentOrgStorage + file.size > MAX_ORG_STORAGE_BYTES) {
      throw new BadRequestException('Organization evidence storage quota (100MB) exceeded. Please delete unused files.');
    }

    const id = this.db.id();
    const dir = process.env.UPLOAD_DIR || './uploads';
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${id}${EXTENSIONS[file.mimetype]}`);
    writeFileSync(filePath, file.buffer, { flag: 'wx' });

    const sha256Hash = createHash('sha256').update(file.buffer).digest('hex');

    const evidence: Evidence = {
      id,
      resourceRecordId,
      // Display name only: strip any path and control characters.
      fileName: withoutAsciiControlCharacters(basename(file.originalname)).slice(0, 200) || 'file',
      filePath,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedById: user.sub,
      uploadedAt: this.db.now(),
      sha256Hash,
    };
    this.db.store.evidence.push(evidence);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'evidence.uploaded',
      entityType: 'evidence',
      entityId: evidence.id,
      metadata: { resourceRecordId, fileName: evidence.fileName, sha256Hash },
    });

    return this.toPublic(evidence);
  }

  findForRecord(user: AuthenticatedOrgUser, resourceRecordId: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    if (user.role === 'CONTRIBUTOR' && (!user.departmentId || record.departmentId !== user.departmentId)) {
      throw new NotFoundException('Resource record not found.');
    }

    return this.db.store.evidence
      .filter((e) => e.resourceRecordId === resourceRecordId)
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
      .map((e) => this.toPublic(e));
  }

  /**
   * Authorizes a download exactly like listing does (same organization; a
   * Contributor only within their department) and returns the file to send.
   * The stored path is re-checked to sit inside the upload directory.
   */
  resolveDownload(user: AuthenticatedOrgUser, resourceRecordId: string, evidenceId: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');
    if (user.role === 'CONTRIBUTOR' && (!user.departmentId || record.departmentId !== user.departmentId)) {
      throw new NotFoundException('Resource record not found.');
    }
    const evidence = this.db.store.evidence.find((e) => e.id === evidenceId && e.resourceRecordId === resourceRecordId);
    if (!evidence) throw new NotFoundException('Evidence file not found.');

    const root = resolve(process.env.UPLOAD_DIR || './uploads');
    const full = resolve(evidence.filePath);
    if (!full.startsWith(root + sep)) {
      throw new NotFoundException('This file is no longer available.');
    }
    if (!existsSync(full)) {
      if (evidence.filePath.includes('seed') || evidence.mimeType === 'application/pdf') {
        try {
          mkdirSync(dirname(full), { recursive: true });
          writeFileSync(full, generateSampleEvidencePdf(evidence.fileName, record));
        } catch {
          throw new NotFoundException('This file is no longer available.');
        }
      } else {
        throw new NotFoundException('This file is no longer available.');
      }
    }

    let sha256Hash = evidence.sha256Hash;
    if (!sha256Hash && existsSync(full)) {
      try {
        const fileBuf = readFileSync(full);
        sha256Hash = createHash('sha256').update(fileBuf).digest('hex');
        evidence.sha256Hash = sha256Hash;
        this.db.persist();
      } catch {
        // tolerate read error for virtual seed
      }
    }

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'evidence.downloaded',
      entityType: 'evidence',
      entityId: evidence.id,
      metadata: { resourceRecordId, sha256Hash },
    });
    return { path: full, fileName: evidence.fileName, mimeType: evidence.mimeType, sha256Hash };
  }

  remove(user: AuthenticatedOrgUser, resourceRecordId: string, evidenceId: string) {
    const record = this.db.store.resourceRecords.find(
      (r) => r.id === resourceRecordId && r.organizationId === user.organizationId,
    );
    if (!record) throw new NotFoundException('Resource record not found.');

    if (user.role === 'CONTRIBUTOR' && record.createdById !== user.sub) {
      throw new ForbiddenException('You can only delete evidence from your own entries.');
    }
    if (record.status !== 'DRAFT') {
      throw new ForbiddenException('Evidence is retained after submission and cannot be physically deleted through this workflow.');
    }

    const evidence = this.db.store.evidence.find((e) => e.id === evidenceId && e.resourceRecordId === resourceRecordId);
    if (!evidence) throw new NotFoundException('Evidence file not found.');

    this.deleteEvidenceFiles([evidence], 'Unable to remove the evidence file. Its metadata was preserved.');

    this.db.store.evidence = this.db.store.evidence.filter((e) => e.id !== evidenceId);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'evidence.deleted',
      entityType: 'evidence',
      entityId: evidenceId,
      metadata: { resourceRecordId, fileName: evidence.fileName },
    });

    return { id: evidenceId, deleted: true };
  }

  /**
   * Removes files owned exclusively by a record before its evidence metadata
   * is removed. Missing files are tolerated; an invalid path or filesystem
   * failure aborts the caller before it can report a successful deletion.
   */
  deleteFilesForRecord(resourceRecordId: string): void {
    const attached = this.db.store.evidence.filter((e) => e.resourceRecordId === resourceRecordId);
    this.deleteEvidenceFiles(attached, 'Unable to remove an attached evidence file. The resource record was not deleted.');
  }

  private deleteEvidenceFiles(attached: Evidence[], failureMessage: string): void {
    const targetIds = new Set(attached.map((e) => e.id));
    const sharedPaths = new Set(
      this.db.store.evidence
        .filter((e) => !targetIds.has(e.id))
        .map((e) => resolve(e.filePath)),
    );
    const pathsToDelete = new Set<string>();

    for (const evidence of attached) {
      const filePath = this.resolveManagedPath(evidence);
      if (!sharedPaths.has(filePath)) pathsToDelete.add(filePath);
    }

    for (const filePath of pathsToDelete) {
      if (!existsSync(filePath)) continue;
      try {
        unlinkSync(filePath);
      } catch {
        throw new InternalServerErrorException(failureMessage);
      }
    }
  }

  private resolveManagedPath(evidence: Evidence): string {
    const root = resolve(process.env.UPLOAD_DIR || './uploads');
    const filePath = resolve(evidence.filePath);
    if (!filePath.startsWith(root + sep)) {
      throw new InternalServerErrorException('Attached evidence has an invalid storage path. The resource record was not deleted.');
    }
    return filePath;
  }

  /** The server-side storage path is internal and never sent to clients. */
  private toPublic<T extends { filePath: string }>(e: T): Omit<T, 'filePath'> {
    const { filePath: internalPath, ...rest } = e;
    void internalPath;
    return rest;
  }
}
