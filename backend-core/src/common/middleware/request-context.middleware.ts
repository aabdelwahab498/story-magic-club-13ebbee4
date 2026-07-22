import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context.js';
import crypto from 'crypto';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();

    // Attach trace context to response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', traceId);

    const store = { requestId, traceId };

    RequestContext.run(store, () => {
      next();
    });
  }
}
