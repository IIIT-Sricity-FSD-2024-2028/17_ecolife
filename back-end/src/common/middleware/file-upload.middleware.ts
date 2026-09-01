import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const uploadsDir = join(process.cwd(), '..', 'uploads');
mkdirSync(uploadsDir, { recursive: true });

/**
 * Allowed MIME types for all file upload endpoints.
 * Supported: PDF documents, common images, CSV/Excel spreadsheets.
 */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Maximum file size: 10 MB */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * multerOptions — shared NestJS MulterOptions configuration used by all upload endpoints.
 *
 * Storage:  disk — files saved to /uploads/<timestamp>-<originalname>
 * Limits:   10 MB per file
 * Filtering: rejects unsupported MIME types with a clear 400 Bad Request
 */
export const multerOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const sanitized = (file.originalname || 'file').replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = extname(sanitized) || extname(file.originalname);
      const base = sanitized.endsWith(ext) ? sanitized : `${sanitized}${ext}`;
      cb(null, `${Date.now()}-${base}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (
    _req: any,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(
        new BadRequestException(
          `Unsupported file type: ${file.mimetype}. ` +
          `Allowed types: PDF, images (JPEG/PNG/GIF/WebP), CSV, Excel.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};

