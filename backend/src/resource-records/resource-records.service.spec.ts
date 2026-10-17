import { ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditLogService } from '../database/audit-log.service';
import { createEmptyStore, DataStore, Evidence } from '../database/types';
import { DbService } from '../database/db.service';
import { EvidenceService } from '../evidence/evidence.service';
import { ResourceRecordsService } from './resource-records.service';

describe('ResourceRecordsService.deleteDraft evidence cleanup', () => {
  let uploadDir: string;
  let originalUploadDir: string | undefined;
  let store: DataStore;
  let db: Pick<DbService, 'store' | 'persist'>;
  let service: ResourceRecordsService;
  let evidenceService: EvidenceService;

  const user = {
    sub: 'user-1',
    email: 'contributor@example.test',
    role: 'CONTRIBUTOR' as const,
    organizationId: 'org-1',
    departmentId: 'department-1',
    isOwner: false,
  };

  beforeEach(() => {
    originalUploadDir = process.env.UPLOAD_DIR;
    uploadDir = mkdtempSync(join(tmpdir(), 'tropos-evidence-'));
    process.env.UPLOAD_DIR = uploadDir;
    store = createEmptyStore();
    db = { store, persist: jest.fn() };
    const auditLog = { log: jest.fn() } as unknown as AuditLogService;
    evidenceService = new EvidenceService(db as DbService, auditLog);
    service = new ResourceRecordsService(
      db as DbService,
      auditLog,
      {} as never,
      {} as never,
      {} as never,
      evidenceService,
    );
  });

  afterEach(() => {
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    rmSync(uploadDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function addRecord(id: string, createdById = user.sub) {
    store.resourceRecords.push({
      id,
      organizationId: user.organizationId,
      departmentId: user.departmentId!,
      locationId: null,
      resourceTypeId: 'type-1',
      quantity: 1,
      unit: 'kWh',
      cost: null,
      periodStart: '2026-01-01',
      periodEnd: '2026-01-01',
      notes: null,
      status: 'DRAFT',
      evidenceRequirement: 'NOT_REQUIRED',
      createdById,
      submittedAt: null,
      lockedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  function addEvidence(id: string, resourceRecordId: string, fileName: string, filePath = join(uploadDir, fileName)) {
    const evidence: Evidence = {
      id,
      resourceRecordId,
      fileName,
      filePath,
      mimeType: 'application/pdf',
      fileSizeBytes: 4,
      uploadedById: user.sub,
      uploadedAt: '2026-01-01T00:00:00.000Z',
    };
    store.evidence.push(evidence);
    return evidence;
  }

  it('removes only the deleted record metadata and exclusively owned file', () => {
    addRecord('record-1');
    addRecord('record-2');
    const owned = addEvidence('evidence-1', 'record-1', 'owned.pdf');
    const unrelated = addEvidence('evidence-2', 'record-2', 'unrelated.pdf');
    writeFileSync(owned.filePath, 'owned');
    writeFileSync(unrelated.filePath, 'unrelated');

    service.deleteDraft(user, 'record-1');

    expect(existsSync(owned.filePath)).toBe(false);
    expect(existsSync(unrelated.filePath)).toBe(true);
    expect(store.evidence).toEqual([unrelated]);
    expect(store.resourceRecords.map((record) => record.id)).toEqual(['record-2']);
  });

  it('handles a missing attached file while removing its metadata', () => {
    addRecord('record-1');
    addEvidence('evidence-1', 'record-1', 'missing.pdf');

    expect(() => service.deleteDraft(user, 'record-1')).not.toThrow();
    expect(store.evidence).toEqual([]);
    expect(store.resourceRecords).toEqual([]);
  });

  it('does not delete a file still referenced by another record', () => {
    addRecord('record-1');
    addRecord('record-2');
    const sharedPath = join(uploadDir, 'shared.pdf');
    addEvidence('evidence-1', 'record-1', 'shared.pdf', sharedPath);
    const remaining = addEvidence('evidence-2', 'record-2', 'shared.pdf', sharedPath);
    writeFileSync(sharedPath, 'shared');

    service.deleteDraft(user, 'record-1');

    expect(existsSync(sharedPath)).toBe(true);
    expect(store.evidence).toEqual([remaining]);
    expect(store.resourceRecords.map((record) => record.id)).toEqual(['record-2']);
  });

  it('rejects an outside path without changing records or evidence', () => {
    addRecord('record-1');
    const outsideDir = mkdtempSync(join(tmpdir(), 'tropos-outside-'));
    const outside = join(outsideDir, 'outside.pdf');
    const evidence = addEvidence('evidence-1', 'record-1', 'outside.pdf', outside);
    writeFileSync(outside, 'outside');

    expect(() => service.deleteDraft(user, 'record-1')).toThrow(InternalServerErrorException);
    expect(existsSync(outside)).toBe(true);
    expect(store.evidence).toEqual([evidence]);
    expect(store.resourceRecords).toHaveLength(1);
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('does not report success when filesystem deletion fails', () => {
    addRecord('record-1');
    const evidence = addEvidence('evidence-1', 'record-1', 'blocked.pdf');
    writeFileSync(evidence.filePath, 'blocked');
    jest.spyOn(require('fs'), 'unlinkSync').mockImplementation(() => {
      throw new Error('permission denied');
    });

    expect(() => service.deleteDraft(user, 'record-1')).toThrow(InternalServerErrorException);
    expect(store.evidence).toEqual([evidence]);
    expect(store.resourceRecords).toHaveLength(1);
  });

  it('deletes an unshared evidence file and metadata directly', () => {
    addRecord('record-1');
    const evidence = addEvidence('evidence-1', 'record-1', 'direct.pdf');
    writeFileSync(evidence.filePath, 'direct');

    evidenceService.remove(user, 'record-1', evidence.id);

    expect(existsSync(evidence.filePath)).toBe(false);
    expect(store.evidence).toEqual([]);
  });

  it('treats a missing direct-delete file as already removed', () => {
    addRecord('record-1');
    const evidence = addEvidence('evidence-1', 'record-1', 'missing-direct.pdf');

    expect(() => evidenceService.remove(user, 'record-1', evidence.id)).not.toThrow();
    expect(store.evidence).toEqual([]);
  });

  it('preserves direct-delete metadata when the path is outside the upload root', () => {
    addRecord('record-1');
    const outsideDir = mkdtempSync(join(tmpdir(), 'tropos-outside-'));
    const evidence = addEvidence('evidence-1', 'record-1', 'outside.pdf', join(outsideDir, 'outside.pdf'));
    writeFileSync(evidence.filePath, 'outside');

    expect(() => evidenceService.remove(user, 'record-1', evidence.id)).toThrow(InternalServerErrorException);
    expect(store.evidence).toEqual([evidence]);
    expect(existsSync(evidence.filePath)).toBe(true);
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it('preserves metadata when direct filesystem deletion fails and preserves shared files', () => {
    addRecord('record-1');
    addRecord('record-2');
    const sharedPath = join(uploadDir, 'shared-direct.pdf');
    const evidence = addEvidence('evidence-1', 'record-1', 'shared-direct.pdf', sharedPath);
    addEvidence('evidence-2', 'record-2', 'shared-direct.pdf', sharedPath);
    writeFileSync(sharedPath, 'shared');

    evidenceService.remove(user, 'record-1', evidence.id);
    expect(existsSync(sharedPath)).toBe(true);
    expect(store.evidence).toHaveLength(1);

    const remaining = store.evidence[0];
    jest.spyOn(require('fs'), 'unlinkSync').mockImplementation(() => { throw new Error('permission denied'); });
    expect(() => evidenceService.remove(user, 'record-2', remaining.id)).toThrow(InternalServerErrorException);
    expect(store.evidence).toEqual([remaining]);
  });

  it('denies another contributor, another organization, and locked records', () => {
    addRecord('record-1');
    const evidence = addEvidence('evidence-1', 'record-1', 'private.pdf');
    const otherContributor = { ...user, sub: 'user-2' };
    const otherOrganization = { ...user, sub: 'user-3', organizationId: 'org-2', departmentId: 'department-2' };
    const unscopedContributor = { ...user, sub: 'user-4', departmentId: null };

    expect(() => evidenceService.remove(otherContributor, 'record-1', evidence.id)).toThrow(ForbiddenException);
    expect(() => evidenceService.findForRecord(otherOrganization, 'record-1')).toThrow(NotFoundException);
    expect(() => evidenceService.resolveDownload(otherOrganization, 'record-1', evidence.id)).toThrow(NotFoundException);
    expect(() => evidenceService.remove(otherOrganization, 'record-1', evidence.id)).toThrow(NotFoundException);
    expect(() => evidenceService.findForRecord(unscopedContributor, 'record-1')).toThrow(NotFoundException);
    expect(() => evidenceService.resolveDownload(unscopedContributor, 'record-1', evidence.id)).toThrow(NotFoundException);

    store.resourceRecords[0].status = 'LOCKED';
    expect(() => evidenceService.remove(user, 'record-1', evidence.id)).toThrow(ForbiddenException);
  });

  it('retains evidence after a record has been submitted or withdrawn', () => {
    addRecord('record-1');
    const evidence = addEvidence('evidence-1', 'record-1', 'retained.pdf');
    store.resourceRecords[0].status = 'SUBMITTED';
    expect(() => evidenceService.remove(user, 'record-1', evidence.id)).toThrow(ForbiddenException);
    store.resourceRecords[0].status = 'WITHDRAWN';
    expect(() => evidenceService.remove(user, 'record-1', evidence.id)).toThrow(ForbiddenException);
    expect(store.evidence).toEqual([evidence]);
  });
});
