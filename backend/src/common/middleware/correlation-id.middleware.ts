import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

/** Async-local store that holds the current request's correlation ID. */
export const correlationStorage = new AsyncLocalStorage<string>();

/** HTTP header name used to propagate the correlation ID. */
export const CORRELATION_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers[CORRELATION_HEADER] as string) || randomUUID();

    res.setHeader(CORRELATION_HEADER, correlationId);

    correlationStorage.run(correlationId, () => next());
  }
}
