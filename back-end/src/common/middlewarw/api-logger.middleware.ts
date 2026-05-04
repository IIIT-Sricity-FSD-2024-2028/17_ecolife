import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(`[API] ${req.method} ${req.originalUrl} role=${req.header('x-role') || 'none'} status=${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    next();
  }
}
