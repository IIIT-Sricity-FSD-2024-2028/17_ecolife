import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const role = (req as any).user?.role ?? 'anonymous';
      this.logger.info('request', { method, url: originalUrl, statusCode: res.statusCode, durationMs, ip, role });
    });

    next();
  }
}
