import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * ApiLoggerMiddleware — Router-level middleware applied to all /api/* routes.
 * Writes one structured JSON entry per request to the daily rotating log file:
 *   logs/app-YYYY-MM-DD.log
 *
 * Also prints to console for real-time visibility during development.
 */
@Injectable()
export class ApiLoggerMiddleware implements NestMiddleware {
  private readonly logger = new AppLoggerService();

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';

      const entry = {
        method:      req.method,
        url:         req.originalUrl,
        role:        req.header('x-role') || 'none',
        statusCode:  res.statusCode,
        durationMs,
        ip:          req.ip || req.socket?.remoteAddress || 'unknown',
        userAgent:   req.header('user-agent') || '',
      };

      if (level === 'error') {
        this.logger.error(`[API] ${req.method} ${req.originalUrl}`, entry);
      } else if (level === 'warn') {
        this.logger.warn(`[API] ${req.method} ${req.originalUrl}`, entry);
      } else {
        this.logger.log(`[API] ${req.method} ${req.originalUrl}`, entry);
      }
    });

    next();
  }
}
