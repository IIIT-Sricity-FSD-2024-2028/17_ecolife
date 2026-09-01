import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ImportBatchDto, UpdateImportBatchDto } from '../common/base.dto';
import { multerOptions } from '../common/middleware/file-upload.middleware';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { ImportsService } from './imports.service';
import { readFileSync, unlinkSync } from 'node:fs';

@ApiTags('imports')
@Controller('imports')
@ApiHeader({ name: 'x-role', description: 'Manager creates import batches; review roles can inspect status and row errors.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.' })
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get() @Roles('Super User', 'COO', 'Manager', 'Analyst') list() { return ok('Import batches loaded.', this.imports.list()); }
  @Get('errors') @Roles('Super User', 'COO', 'Manager', 'Analyst') errors() { return ok('Import errors loaded.', this.imports.errors()); }
  @Get(':id') @Roles('Super User', 'COO', 'Manager', 'Analyst') find(@Param('id') id: string) { return ok('Import batch loaded.', this.imports.find(id)); }
  @Post() @Roles('Super User', 'Manager') create(@Body() dto: ImportBatchDto) { return ok('Import batch registered.', this.imports.create(dto)); }
  @Patch(':id') @Roles('Super User', 'Manager', 'Analyst') update(@Param('id') id: string, @Body() dto: UpdateImportBatchDto) { return ok('Import batch updated.', this.imports.update(id, dto)); }
  @Put(':id') @Roles('Super User', 'Manager', 'Analyst') replace(@Param('id') id: string, @Body() dto: UpdateImportBatchDto) { return ok('Import batch updated.', this.imports.update(id, dto)); }
  @Delete(':id') @Roles('Super User') remove(@Param('id') id: string) { return ok('Import batch deleted.', this.imports.remove(id)); }

  /**
   * POST /api/imports/upload
   *
   * File upload middleware endpoint for CSV resource data imports.
   * Accepts a multipart/form-data request with:
   *   - file: CSV file with columns: resourceType, unit, quantity, activityDate, period
   *   - organizationId (form field)
   *   - departmentId   (form field)
   *
   * Supported MIME types: text/csv, application/vnd.ms-excel, Excel XLSX.
   * Max file size: 10 MB.
   *
   * Parses the CSV rows and delegates to the existing ImportBatch pipeline,
   * which creates ResourceRecord entries and runs emission factor calculations.
   */
  @Post('upload')
  @Roles('Super User', 'Manager')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiOperation({ summary: 'Upload a CSV file to create an import batch. Max 10 MB.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'organizationId', 'departmentId'],
      properties: {
        file:           { type: 'string', format: 'binary', description: 'CSV file with columns: resourceType, unit, quantity, activityDate, period' },
        organizationId: { type: 'string', example: 'org-techcorp' },
        departmentId:   { type: 'string', example: 'dept-ops' },
      },
    },
  })
  uploadCsvBatch(
    @UploadedFile() file: Express.Multer.File,
    @Body('organizationId') organizationId: string,
    @Body('departmentId')   departmentId: string,
    @Headers('x-role') _role: string,
  ) {
    if (!file) throw new BadRequestException('Import file is required.');
    if (!organizationId?.trim()) throw new BadRequestException('organizationId is required.');
    if (!departmentId?.trim())   throw new BadRequestException('departmentId is required.');

    // Support CSV format exclusively for data imports as per project specification
    if (
      file.mimetype?.includes('spreadsheet') ||
      file.mimetype?.includes('excel') ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')
    ) {
      if (file.path) try { unlinkSync(file.path); } catch (_) {}
      throw new BadRequestException('Only CSV format is supported for data import. Please upload a .csv file.');
    }

    try {
      // Parse the uploaded CSV file from disk
      const csvContent = readFileSync(file.path, 'utf-8');
      const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new BadRequestException('CSV file must have a header row and at least one data row.');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const hasType = headers.includes('resourcetype') || headers.includes('type');
      const hasUnit = headers.includes('unit');
      const hasQty  = headers.includes('quantity') || headers.includes('qty');
      const hasDate = headers.includes('activitydate') || headers.includes('date');
      const hasPeriod = headers.includes('period');

      if (!hasType || !hasUnit || !hasQty || !hasDate || !hasPeriod) {
        throw new BadRequestException('CSV header row must include required columns: resourceType (or type), unit, quantity (or qty), activityDate, period.');
      }

      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
        return row;
      });

      const batch = this.imports.create({
        fileName:       file.originalname,
        organizationId,
        departmentId,
        rows,
      } as any);

      return ok('CSV import batch processed.', {
        batchId:      batch.id,
        fileName:     file.originalname,
        savedAs:      file.filename,
        totalRows:    rows.length,
        createdRecords: batch.createdRecordIds?.length ?? 0,
        status:       batch.status,
        uploadedAt:   new Date().toISOString(),
      });
    } catch (err) {
      if (file.path) try { unlinkSync(file.path); } catch (_) {}
      throw err;
    }
  }
}

