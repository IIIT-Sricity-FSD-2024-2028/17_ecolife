import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * HttpExceptionFilter — Global exception filter.
 *
 * Catches ALL errors (HTTP exceptions and uncaught runtime errors) and:
 *  1. Writes structured error details to logs/errors-YYYY-MM-DD.log via Winston
 *  2. Returns a consistent JSON error body to the client
 *
 * Error log entry shape:
 * {
 *   timestamp, statusCode, path, method, message, stack (for 5xx only),
 *   role, ip
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new AppLoggerService();

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = isHttpException ? exception.getResponse() : null;
    const message = isHttpException
      ? (typeof rawResponse === 'string'
          ? rawResponse
          : (rawResponse as any)?.message ?? exception.message)
      : (exception instanceof Error ? exception.message : 'Internal server error');

    const stack = exception instanceof Error ? exception.stack : undefined;

    const logEntry: Record<string, unknown> = {
      statusCode,
      path:    req.originalUrl,
      method:  req.method,
      role:    req.header('x-role') || 'none',
      ip:      req.ip || req.socket?.remoteAddress || 'unknown',
      message: Array.isArray(message) ? message.join(', ') : String(message),
    };

    // Include stack trace only for 5xx server errors
    if (statusCode >= 500 && stack) {
      logEntry.stack = stack;
      this.logger.error(`[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}`, logEntry);
    } else {
      this.logger.warn(`[WARN]  ${req.method} ${req.originalUrl} → ${statusCode}`, logEntry);
    }

    const body = {
      statusCode,
      message: Array.isArray(message) ? message : [String(message)],
      error:   HttpStatus[statusCode] ?? 'Error',
      path:    req.originalUrl,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(body);
  }
}
