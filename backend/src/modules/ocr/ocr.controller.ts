import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import multer from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { OcrService } from './ocr.service';

@ApiTags('OCR Bill Extraction')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('extract-bill')
  @Roles('PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  extractBill(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.ocrService.extractBillAndStoreEvidence(user.organizationId!, user.userId, file);
  }
}
