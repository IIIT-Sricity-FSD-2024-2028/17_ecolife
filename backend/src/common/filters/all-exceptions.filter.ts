import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    if (exception instanceof ZodError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Validation failed',
        details: exception.flatten().fieldErrors,
        requestId: req.requestId
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const b = body as { error?: string; message?: string | string[] };
      // Nest puts the human text in `message` and only the status name in `error`; show the human text.
      const message =
        typeof body === 'string'
          ? body
          : (Array.isArray(b.message) ? b.message.join(', ') : b.message) || b.error || exception.message;
      return res.status(status).json({
        error: message,
        details: typeof body === 'object' && body !== null && 'details' in body ? (body as { details: unknown }).details : undefined,
        requestId: req.requestId
      });
    }

    // Anything below is not an HttpException. Never echo internals (SQL, Prisma, stack) to the client.
    const err = exception as { code?: string; name?: string; message?: string; meta?: any; stack?: string };
    const code = err?.code;
    const send = (status: number, error: string) => res.status(status).json({ error, requestId: req.requestId });

    if (code === 'P2002') return send(HttpStatus.CONFLICT, 'A record with the same unique value already exists.');
    if (code === 'P2003') return send(HttpStatus.BAD_REQUEST, 'A referenced record does not exist, or this record is still in use.');
    if (code === 'P2025') return send(HttpStatus.NOT_FOUND, 'Record not found.');
    if (code === 'P2000' || code === 'P2006' || code === 'P2007' || code === 'P2020') return send(HttpStatus.BAD_REQUEST, 'One of the submitted values is out of range or invalid.');
    // Database rules raised on purpose (CHECK constraints / compliance triggers) carry a readable rule text.
    const raw = err?.message || '';
    const ruleMatch = raw.match(/(?:ERROR:|Raw query failed\..*?message: ")\s*([^\n"]{8,300})/);
    const lowerRaw = raw.toLowerCase();
    if (lowerRaw.includes('violates check constraint') || lowerRaw.includes('separation of duties') || lowerRaw.includes('append-only') || lowerRaw.includes('is immutable') || lowerRaw.includes('mutually exclusive')) {
      return send(HttpStatus.BAD_REQUEST, ruleMatch ? ruleMatch[1].trim() : (/no_self_review/.test(raw) ? 'The person who sent a record for review cannot be the one who approves it. Ask another reviewer.' : 'This change breaks a compliance rule enforced by the database.'));
    }

    if (typeof err?.name === 'string' && err.name.startsWith('PrismaClient') && /Argument|Invalid `|Unknown|Expected/.test(err.message || '')) {
      return send(HttpStatus.BAD_REQUEST, 'The request contains an invalid or unsupported value.');
    }

    // Business-rule errors thrown by application code as plain Errors.
    if (exception instanceof Error && exception.constructor === Error) {
      const lower = raw.toLowerCase();
      const isRule = ['cannot', 'must be', 'must ', 'requires', 'insufficient', 'separation of duties', 'already exists', 'not allowed', 'is not'].some((k) => lower.includes(k));
      if (isRule) return send(HttpStatus.BAD_REQUEST, raw);
    }

    // eslint-disable-next-line no-console
    console.error(`[${req.requestId ?? '-'}] Unhandled error:`, exception);
    return send(HttpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong on our side. Please try again; if it keeps happening quote the request id.');
  }
}
