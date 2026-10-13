import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger as WinstonLogger } from 'winston';

interface FieldError {
  field: string;
  message: string;
}

/**
 * Catches every exception and normalizes the response to
 * { success: false, message, errors }. Unexpected errors are logged in
 * full but return a generic message to the client, so stack traces never
 * leak; operational errors (validation, not found, forbidden) return
 * their real, clean message.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger?: WinstonLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong. Please try again.';
    let errors: FieldError[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as any;
        if (Array.isArray(b.message)) {
          message = 'Validation failed';
          errors = b.message.map((m: string) => ({ field: m.split(' ')[0] || 'unknown', message: m }));
        } else {
          message = b.message || message;
          // Services can attach field-level errors, e.g. { field: 'email', message }.
          if (Array.isArray(b.errors)) errors = b.errors;
        }
      }
    } else if (exception instanceof Error) {
      this.log('error', exception.message, { stack: exception.stack, path: request.url });
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.log('error', message, { path: request.url, method: request.method });
    } else {
      this.log('warn', message, { status, path: request.url, method: request.method });
    }

    response.status(status).json({ success: false, message, errors });
  }

  private log(level: 'error' | 'warn', message: string, meta: object) {
    if (this.logger) {
      this.logger.log(level, message, meta);
    } else {
      console.warn(message, meta);
    }
  }
}
