import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { DEFAULT_ORGANIZATION_ID, TenantEnforcementMode } from './tenant.constants';
import { TenantResolutionError } from './tenant.errors';

interface AuthenticatedRequest extends Request {
  user?: {
    // Matches the shape attached by JwtStrategy.validate() — field is `id`,
    // not `userId`. Every guard/handler in the codebase already reads `id`.
    id?: string;
    organizationId?: string;
    membershipId?: string;
    role?: string;
    isSuperAdmin?: boolean;
  };
}

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly ctx: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'strict');

    if (mode === 'off') {
      return next();
    }

    // Priority:
    //   1. JWT claim (authenticated users)
    //   2. X-Org-Id header (super-admins only — never trusted from regular users)
    //   3. Subdomain resolver (added in Plan 09)
    //   4. DEFAULT_ORGANIZATION_ID (permissive mode only)
    const fromJwt = req.user?.organizationId;
    const fromHeader =
      req.user?.isSuperAdmin === true
        ? (req.headers['x-org-id'] as string | undefined)
        : undefined;
    const fromDefault =
      mode === 'permissive'
        ? this.config.get<string>('DEFAULT_ORGANIZATION_ID', DEFAULT_ORGANIZATION_ID)
        : undefined;

    const organizationId = fromJwt ?? fromHeader ?? fromDefault;

    if (!organizationId) {
      throw new TenantResolutionError(
        'Unable to resolve tenant — no JWT claim, no valid header, strict mode active',
      );
    }

    this.ctx.set({
      organizationId,
      membershipId: req.user?.membershipId ?? '',
      id: req.user?.id ?? '',
      role: req.user?.role ?? '',
      isSuperAdmin: req.user?.isSuperAdmin === true,
    });

    next();
  }
}
