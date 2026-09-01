import { Injectable } from '@nestjs/common';
import { createLogger, format, Logger, transports } from 'winston';
import 'winston-daily-rotate-file';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const logsDir = join(process.cwd(), 'logs');
mkdirSync(logsDir, { recursive: true });

/**
 * AppLoggerService — Winston-backed logger with daily rotating file transports.
 *
 * Log files:
 *   logs/app-YYYY-MM-DD.log    — all INFO, WARN, ERROR entries
 *   logs/errors-YYYY-MM-DD.log — only WARN and ERROR entries
 *
 * Rotation policy: new file daily, max 20 MB per file, kept 14 days, zipped.
 */
@Injectable()
export class AppLoggerService {
  private readonly logger: Logger;

  constructor() {
    const sharedFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.json(),
    );

    this.logger = createLogger({
      level: 'info',
      format: sharedFormat,
      transports: [
        // All requests & events → app-YYYY-MM-DD.log
        new (transports as any).DailyRotateFile({
          dirname: logsDir,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
        }),
        // Warnings & errors only → errors-YYYY-MM-DD.log
        new (transports as any).DailyRotateFile({
          dirname: logsDir,
          filename: 'errors-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'warn',
        }),
        // Also print to console in development
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
              return `${timestamp} [${level}] ${message}${metaStr}`;
            }),
          ),
        }),
      ],
    });
  }

  log(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }
}
