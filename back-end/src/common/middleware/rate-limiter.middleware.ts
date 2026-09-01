import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * RateLimiterMiddleware — IP-based request rate limiting.
 *
 * Security middleware applied to all /api/* routes.
 * Allows a maximum of 120 requests per IP per minute window.
 * Exceeding the limit returns HTTP 429 Too Many Requests and logs the
 * blocked IP to the error log file.
 *
 * Uses an in-memory sliding window (Map keyed by IP).
 * The window resets every 60 seconds per IP address.
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new AppLoggerService();

  /** Map<ip, { count: number; windowStart: number }> */
  private readonly ipWindows = new Map<string, { count: number; windowStart: number }>();

  private readonly MAX_REQUESTS_PER_WINDOW = 120;
  private readonly WINDOW_MS = 60_000; // 1 minute

  private cleanupExpired(now: number): void {
    if (this.ipWindows.size > 100) {
      for (const [ip, window] of this.ipWindows.entries()) {
        if (now - window.windowStart > this.WINDOW_MS) {
          this.ipWindows.delete(ip);
        }
      }
    }
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const rawIp = req.header('x-forwarded-for') || req.ip || req.socket?.remoteAddress || 'unknown';
    const ip = String(rawIp).split(',')[0].trim();
    const now = Date.now();
    this.cleanupExpired(now);

    const window = this.ipWindows.get(ip);

    if (!window || now - window.windowStart > this.WINDOW_MS) {
      // Start new window for this IP
      this.ipWindows.set(ip, { count: 1, windowStart: now });
      return next();
    }

    window.count += 1;

    if (window.count > this.MAX_REQUESTS_PER_WINDOW) {
      this.logger.warn('[RATE-LIMIT] Request blocked — too many requests', {
        ip,
        count: window.count,
        method: req.method,
        url: req.originalUrl,
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: ['Too many requests. Maximum 120 requests per minute allowed.'],
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
