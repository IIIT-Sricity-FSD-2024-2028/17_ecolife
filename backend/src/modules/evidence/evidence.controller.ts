import { BadRequestException, Controller, Get, Injectable, NotFoundException, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import multer from 'multer';
import { writeAuditLog } from '../../common/utils/audit.util';
import { LEGACY_CAP, pageResult, parsePaging } from '../../common/utils/paging.util';
import { PrismaService } from '../../prisma/prisma.service';
import { putFile, getFile } from '../../common/storage/file-store';
import { sha256 } from '../../common/utils/crypto.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Without paging: latest 150 (legacy). With page/pageSize: full paged list; ?q= searches the file name. */
  async list(organizationId: string, q: Record<string, any> = {}) {
    const paged = q.page !== undefined || q.pageSize !== undefined;
    const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&') : '';
    const where: any = { organizationId, ...(term ? { fileName: { contains: term, mode: 'insensitive' } } : {}) };
    return this.prisma.withTenantTx(organizationId, async (tx) => {
      if (!paged) return tx.evidenceFile.findMany({ where, orderBy: { uploadedAt: 'desc' }, take: 150 });
      const paging = parsePaging(q);
      const [items, total] = await Promise.all([
        tx.evidenceFile.findMany({ where, orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take }),
        tx.evidenceFile.count({ where })
      ]);
      return pageResult(paging, items, total);
    });
  }

  async upload(organizationId: string, userId: string, file: Express.Multer.File, entryId?: string) {
    if (!file) throw new BadRequestException('No file provided');
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Allowed file types: PDF, PNG, JPEG, CSV');
    }
    // The browser-declared type can be faked, so check the file's own signature as well.
    const b = file.buffer;
    const okSig = file.mimetype === 'application/pdf' ? b.subarray(0, 5).toString('latin1') === '%PDF-'
      : file.mimetype === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : file.mimetype === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
      : !b.subarray(0, 4096).includes(0); // CSV must be text
    if (!okSig) throw new BadRequestException('The file content does not match its type. Upload a real PDF, PNG, JPEG or CSV.');
    if (entryId) {
      const ok = await this.prisma.withTenantTx(organizationId, (tx) => tx.resourceEntry.findFirst({ where: { id: entryId, organizationId }, select: { id: true } }).catch(() => null));
      if (!ok) throw new BadRequestException('That entry was not found in your organization.');
    }

    const hash = sha256(file.buffer);
    const storageKey = `${organizationId}/${Date.now()}_${hash.slice(0, 12)}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await putFile(storageKey, file.buffer, file.mimetype);

    const evidence = await this.prisma.withTenantTx(organizationId, async (tx) => {
      const created = await tx.evidenceFile.create({
        data: {
          organizationId,
          entryId: entryId || undefined,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          fileSha256: hash,
          uploadedById: userId
        }
      });
      await writeAuditLog(tx, { organizationId, actorId: userId, action: 'EVIDENCE_UPLOADED', resourceType: 'EvidenceFile', resourceId: created.id, metadata: { sha256: hash, entryId: entryId ?? null } });
      return created;
    });
    return { evidence };
  }

  async verifyIntegrity(organizationId: string, id: string) {
    const fileRec = await this.prisma.withTenantTx(organizationId, (tx) =>
      tx.evidenceFile.findUnique({ where: { id } })
    );
    if (!fileRec) throw new NotFoundException('Evidence file not found');
    const bytes = await getFile(fileRec.storageKey);
    if (!bytes) {
      return { id: fileRec.id, fileName: fileRec.fileName, intact: false, reason: 'File is missing from storage', storedSha256: fileRec.fileSha256 };
    }
    const computedSha256 = sha256(bytes);
    return {
      id: fileRec.id,
      fileName: fileRec.fileName,
      intact: computedSha256 === fileRec.fileSha256,
      storedSha256: fileRec.fileSha256,
      computedSha256,
      isLocked: fileRec.isLocked,
      verifiedAt: new Date().toISOString()
    };
  }

  async getDownloadStream(organizationId: string, id: string) {
    const fileRec = await this.prisma.withTenantTx(organizationId, (tx) =>
      tx.evidenceFile.findUnique({ where: { id } })
    );
    if (!fileRec) throw new NotFoundException('Evidence file not found');
    const buffer = await getFile(fileRec.storageKey);
    if (!buffer) throw new NotFoundException('The stored file could not be found.');
    return { fileRec, buffer };
  }
}

@ApiTags('Evidence Vault')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    return this.service.list(user.organizationId!, q);
  }

  @Post('upload')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body('entryId') entryId?: string) {
    return this.service.upload(user.organizationId!, user.userId, file, entryId);
  }

  @Get(':id/verify-integrity')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.verifyIntegrity(user.organizationId!, id);
  }

  @Get(':id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { fileRec, buffer } = await this.service.getDownloadStream(user.organizationId!, id);
    res.setHeader('Content-Type', fileRec.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileRec.fileName}"`);
    return res.send(buffer);
  }
}
