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
    // Public routes embed tenantId in the URL (e.g. /api/v1/public/branding/:tenantId).
    // Use originalUrl which always contains the full path regardless of mount point.
    const fullPath = req.originalUrl ?? req.url ?? '';
    const isPublicRoute = fullPath.includes('/public/');

    const headerTenantId = req.headers['x-tenant-id'];
    const urlTenantId = isPublicRoute
      ? fullPath.split('/').find((seg) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg))
      : undefined;

    const tenantId = headerTenantId ?? urlTenantId;

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
