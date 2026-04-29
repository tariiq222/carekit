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

  /**
   * Public mobile routes that may resolve their tenant from the X-Org-Id
   * header. Webhook routes are excluded — they have their own system-context
   * resolution flow (see SaaS-02e moyasar-webhook).
   */
  private isPublicRoute(path: string): boolean {
    // Accept both prefixed (`/api/v1/public/...` in production) and bare
    // (`/public/...` in tests, where setGlobalPrefix is not applied).
    if (
      !path.startsWith('/api/v1/public/') &&
      !path.startsWith('/public/') &&
      !path.endsWith('/auth/login')
    ) {
      return false;
    }
    if (path.includes('/webhooks/')) return false;
    return true;
  }

  /**
   * Validates a header value as a well-formed UUID (RFC 4122, any version
   * including the all-zero placeholder used as DEFAULT_ORGANIZATION_ID).
   * Returns the trimmed value when valid, undefined otherwise.
   */
  private parseUuidHeader(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
      ? trimmed
      : undefined;
  }

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'strict');

    if (mode === 'off') {
      return next();
    }

    const path = req.originalUrl ?? req.url ?? req.path ?? '';
    const isPublicRoute = this.isPublicRoute(path);
    const fromSuperAdminHeader =
      req.user?.isSuperAdmin === true
        ? this.parseUuidHeader(req.headers['x-org-id'])
        : undefined;

    if (!isPublicRoute && !req.user) {
      if (mode === 'permissive') {
        this.ctx.set({
          organizationId: this.config.get<string>(
            'DEFAULT_ORGANIZATION_ID',
            DEFAULT_ORGANIZATION_ID,
          ),
          membershipId: '',
          id: '',
          role: '',
          isSuperAdmin: false,
        });
      }
      return next();
    }

    const fromJwt = req.user?.organizationId;
    const fromPublicHeader =
      !req.user && isPublicRoute ? this.parseUuidHeader(req.headers['x-org-id']) : undefined;
    const fromDefault =
      mode === 'permissive'
        ? this.config.get<string>('DEFAULT_ORGANIZATION_ID', DEFAULT_ORGANIZATION_ID)
        : undefined;

    const organizationId = fromSuperAdminHeader ?? fromJwt ?? fromPublicHeader ?? fromDefault;

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
