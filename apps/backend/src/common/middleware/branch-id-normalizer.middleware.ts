import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { FeatureFlagsService } from '../../modules/feature-flags/feature-flags.service.js';

/**
 * Strips `branchId` from request body and query parameters when the
 * `multi_branch` feature flag is disabled.
 *
 * This ensures that any endpoint accepting an optional `branchId` (bookings,
 * practitioners availability, reports, intake-forms, etc.) behaves as if
 * branches do not exist — falling back to global settings and queries —
 * without requiring every service to check the feature flag individually.
 */
@Injectable()
export class BranchIdNormalizerMiddleware implements NestMiddleware {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const enabled = await this.featureFlagsService.isEnabled('multi_branch');

    if (!enabled) {
      // Strip from query string
      if (req.query && 'branchId' in req.query) {
        delete (req.query as Record<string, unknown>)['branchId'];
      }

      // Strip from request body (handles JSON body)
      if (req.body && typeof req.body === 'object' && 'branchId' in req.body) {
        delete (req.body as Record<string, unknown>)['branchId'];
      }
    }

    next();
  }
}
