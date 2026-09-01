import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EvidenceDto, UpdateEvidenceDto } from '../common/base.dto';
import { multerOptions } from '../common/middleware/file-upload.middleware';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@Controller('evidence')
@ApiHeader({ name: 'x-role', description: 'Manager uploads evidence; Analyst/COO/Super User can review evidence status.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Evidence loaded.', this.evidence.list()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Evidence loaded.', this.evidence.find(id)); }
  @Post() @Roles('Super User', 'Manager') create(@Body() dto: EvidenceDto) { return ok('Evidence registered.', this.evidence.create(dto)); }
  @Patch(':id') @Roles('Super User', 'Manager', 'Analyst') update(@Param('id') id: string, @Body() dto: UpdateEvidenceDto) { return ok('Evidence updated.', this.evidence.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'Manager', 'Analyst') replace(@Param('id') id: string, @Body() dto: UpdateEvidenceDto) { return ok('Evidence updated.', this.evidence.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Evidence deleted.', this.evidence.remove(id)); }

  /**
   * POST /api/evidence/upload
   *
   * File upload middleware endpoint.
   * Accepts a multipart/form-data request with a single file field named "file".
   * Supported MIME types: PDF, images (JPEG/PNG/GIF/WebP).
   * Max file size: 10 MB.
   *
   * The uploaded file is saved to the /uploads/ directory on disk with a
   * timestamp-prefixed filename to prevent collisions.
   *
   * Returns the saved file path and metadata so the caller can register
   * evidence by making a follow-up POST /api/evidence with the filePath.
   */
  @Post('upload')
  @Roles('Super User', 'Manager')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload an evidence file (PDF or image). Max 10 MB.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Evidence file (PDF, JPEG, PNG, GIF, WebP). Max 10 MB.' },
      },
    },
  })
  uploadEvidenceFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Evidence file is required.');
    return ok('Evidence file uploaded successfully.', {
      originalName: file.originalname,
      savedAs:      file.filename,
      filePath:     file.path,
      mimeType:     file.mimetype,
      sizeBytes:    file.size,
      uploadedAt:   new Date().toISOString(),
    });
  }
}

