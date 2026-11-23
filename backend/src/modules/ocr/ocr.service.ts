import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PrismaService } from '../../prisma/prisma.service';
import { putFile } from '../../common/storage/file-store';
import { sha256 } from '../../common/utils/crypto.util';
import { parseIndianBillText } from './bill-parser.util';

@Injectable()
export class OcrService {
  constructor(private readonly prisma: PrismaService) {}

  async extractBillAndStoreEvidence(
    organizationId: string,
    userId: string,
    file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Please upload a PDF, PNG, or JPEG bill file.');
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('OCR supports PDF, PNG, and JPEG utility/fuel bills.');
    }

    let rawText = '';
    let engine = 'pdf-parse';

    if (file.mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
      try {
        rawText = (await parser.getText()).text || '';
      } catch {
        throw new BadRequestException('This PDF could not be read. Upload a clear, unprotected bill.');
      } finally {
        await parser.destroy();
      }
    } else {
      engine = 'tesseract.js';
      const worker = await createWorker('eng');
      try {
        const result = await worker.recognize(file.buffer);
        rawText = result.data?.text || '';
      } finally {
        await worker.terminate();
      }
    }

    const extracted = parseIndianBillText(rawText);

    // Store tamper-evident SHA-256 EvidenceFile immediately so Plant Manager can link it to the entry
    const fileHash = sha256(file.buffer);
    const storageKey = `${organizationId}/${Date.now()}_${fileHash.slice(0, 12)}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await putFile(storageKey, file.buffer, file.mimetype);

    const { evidence, duplicateHashDetected } = await this.prisma.withTenantTx(organizationId, async (tx) => {
      const existingDup = await tx.evidenceFile.findFirst({
        where: { organizationId, fileSha256: fileHash },
        select: { id: true, fileName: true }
      });

      const ev = await tx.evidenceFile.create({
        data: {
          organizationId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          fileSha256: fileHash,
          uploadedById: userId
        }
      });
      return { evidence: ev, duplicateHashDetected: Boolean(existingDup) };
    });

    return {
      engine,
      extracted,
      duplicateHashDetected,
      evidence: {
        id: evidence.id,
        fileName: evidence.fileName,
        fileSha256: evidence.fileSha256
      }
    };
  }
}
