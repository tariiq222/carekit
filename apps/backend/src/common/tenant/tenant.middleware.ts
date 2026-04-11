import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RequestContextStorage } from './request-context';

/**
 * Extracts tenantId from the X-Tenant-ID header and binds a RequestContext
 * to AsyncLocalStorage for the duration of the request.
 *
 * Required on every route — requests without X-Tenant-ID are rejected.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const tenantId = req.headers['x-tenant-id'];

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new BadRequestException('X-Tenant-ID header is required');
    }

    const ctx = {
      tenantId: tenantId.trim(),
      requestId: (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
      userId: undefined,
      ip: req.ip,
    };

    res.setHeader('x-request-id', ctx.requestId);

    RequestContextStorage.run(ctx, () => next());
  }
}
