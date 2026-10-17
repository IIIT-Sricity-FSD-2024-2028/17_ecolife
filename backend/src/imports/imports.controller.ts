import { BadRequestException, Controller, Get, Param, Post, UploadedFile, UseInterceptors, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { ImportsService } from './imports.service';

@ApiTags('CSV Imports')
@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post('resource-records/preview')
  @OrgAuth('CONTRIBUTOR')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Validate and classify a resource-record CSV without creating drafts' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
        if (!isCsv) return cb(new BadRequestException('Only CSV files are accepted.'), false);
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  previewCsv(@CurrentUser() user: AuthenticatedOrgUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    return { data: this.service.previewCsv(user, file) };
  }

  @Post('resource-records')
  @OrgAuth('CONTRIBUTOR')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk-import resource usage entries via CSV (Contributor)',
    description:
      'Columns: resourceTypeName, quantity, unit, cost (optional), periodStart, periodEnd, notes (optional). Invalid rows are reported individually, not silently dropped.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
        if (!isCsv) return cb(new BadRequestException('Only CSV files are accepted.'), false);
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCsv(@CurrentUser() user: AuthenticatedOrgUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    const result = this.service.importCsv(user, file);
    return {
      message: `Import complete: ${result.batch.successRows} of ${result.batch.totalRows} rows created successfully.`,
      data: result,
    };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List past import batches' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get import batch details, including per-row errors' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }
}
