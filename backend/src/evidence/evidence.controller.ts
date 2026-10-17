import { BadRequestException, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ALLOWED_MIME_TYPES, EvidenceService } from './evidence.service';

@ApiTags('Evidence')
@Controller('resource-records/:recordId/evidence')
export class EvidenceController {
  constructor(private readonly service: EvidenceService) {}

  @Post()
  @OrgAuth('CONTRIBUTOR')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload evidence for a resource record (Contributor)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // nothing touches disk until the service has authorized the request
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException(`File type "${file.mimetype}" is not allowed.`), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    const evidence = this.service.attach(user, recordId, file);
    return { message: 'Evidence uploaded.', data: evidence };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List evidence files attached to a resource record' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser, @Param('recordId', ParseUUIDPipe) recordId: string) {
    return this.service.findForRecord(user, recordId);
  }

  @Get(':evidenceId/download')
  @OrgAuth()
  @ApiOperation({ summary: 'Download an evidence file (same access rules as listing)' })
  download(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Res() res: Response,
  ) {
    const file = this.service.resolveDownload(user, recordId, evidenceId);
    // Always an attachment, never rendered inline, and never sniffed into another type.
    const asciiName = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    if (file.sha256Hash) {
      res.setHeader('ETag', `"${file.sha256Hash}"`);
      res.setHeader('X-Evidence-SHA256', file.sha256Hash);
    }
    res.sendFile(file.path);
  }

  @Get(':evidenceId/view')
  @OrgAuth()
  @ApiOperation({ summary: 'View an evidence file inline (same access rules as listing)' })
  view(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Res() res: Response,
  ) {
    const file = this.service.resolveDownload(user, recordId, evidenceId);
    const asciiName = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    if (file.sha256Hash) {
      res.setHeader('ETag', `"${file.sha256Hash}"`);
      res.setHeader('X-Evidence-SHA256', file.sha256Hash);
    }
    res.sendFile(file.path);
  }

  @Delete(':evidenceId')
  @OrgAuth('CONTRIBUTOR')
  @ApiOperation({ summary: 'Delete an evidence file (Contributor)' })
  remove(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.service.remove(user, recordId, evidenceId);
  }
}
