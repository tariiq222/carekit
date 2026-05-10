import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import { SubdomainResolverService } from './subdomain-resolver.service';
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
    private readonly subdomainResolver: SubdomainResolverService,
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
   * Tenant-bootstrap routes that legitimately have no tenant yet — they
   * CREATE the tenant. Skip resolution entirely so strict mode doesn't
   * reject the request before the controller runs. These handlers must
   * call `tenant.set()` themselves once the org exists.
   */
  private isTenantBootstrapRoute(path: string): boolean {
    return (
      path.endsWith('/public/tenants/register') ||
      path.endsWith('/api/v1/public/tenants/register')
    );
  }

  /**
   * Auth-bootstrap routes that have no JWT and no org context yet — the
   * handlers themselves resolve or issue the tenant context after
   * authenticating the caller. Bypasses tenant resolution entirely so
   * strict mode does not reject requests before the controller runs.
   *
   * Scope: @Controller('auth') endpoints under global prefix api/v1.
   * - /auth/login    — LoginHandler resolves org from Membership after auth
   * - /auth/refresh  — issues new token pair; uses $allTenants internally
   * - /auth/logout   — revokes token; uses $allTenants internally
   *
   * NOT included: /public/auth/* (client auth — requires X-Org-Id from
   * mobile tenant-lock) and /mobile/auth/* (mobile — sends X-Org-Id header).
   */
  private isAuthBootstrapRoute(path: string): boolean {
    return (
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/refresh') ||
      path.endsWith('/auth/logout') ||
      path.endsWith('/auth/otp/request-dashboard') ||
      path.endsWith('/auth/otp/verify-dashboard')
    );
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

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const mode = this.config.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'strict');

    if (mode === 'off') {
      return next();
    }

    const path = req.originalUrl ?? req.url ?? req.path ?? '';
    if (this.isTenantBootstrapRoute(path)) {
      return next();
    }

    if (this.isAuthBootstrapRoute(path)) {
      return next();
    }

    const isPublicRoute = this.isPublicRoute(path);

    // Priority:
    //   1. JWT claim (authenticated users)
    //   2. X-Org-Id header (super-admins only — never trusted from regular users)
    //   3. X-Org-Id header on UNAUTHENTICATED public routes (mobile tenant-lock)
    //   4. Subdomain resolver — maps <slug>.deqah.net to organizationId (Plan 09)
    //   5. DEFAULT_ORGANIZATION_ID (permissive mode only)
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

    const hostHeader =
      (req.headers['x-forwarded-host'] as string | undefined) ??
      req.hostname ??
      (req.headers.host as string | undefined);

    const fromSubdomain = !req.user
      ? await this.subdomainResolver.resolve(hostHeader)
      : null;

    const fromDefault =
      mode === 'permissive'
        ? this.config.get<string>('DEFAULT_ORGANIZATION_ID', DEFAULT_ORGANIZATION_ID)
        : undefined;

    const organizationId =
      fromSuperAdminHeader ?? fromJwt ?? fromPublicHeader ?? fromSubdomain ?? fromDefault;

    // Public routes (e.g. /public/branding, /public/auth/*) are designed to work
    // without a tenant context — handlers use requireOrganizationIdOrDefault() which
    // falls back gracefully. Allow them through even in strict mode when no header/JWT.
    if (!organizationId && isPublicRoute) {
      return next();
    }

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
