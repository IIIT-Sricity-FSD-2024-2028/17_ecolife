import { BadRequestException, Controller, Get, Param, Post, UploadedFile, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { EvidenceService } from './evidence.service';

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
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || './uploads',
        filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(new BadRequestException(`File type "${file.mimetype}" is not allowed.`), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    this.service.validateFile(file);
    const evidence = this.service.attach(user, recordId, file);
    return { message: 'Evidence uploaded.', data: evidence };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List evidence files attached to a resource record' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser, @Param('recordId', ParseUUIDPipe) recordId: string) {
    return this.service.findForRecord(user, recordId);
  }
}
