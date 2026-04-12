import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mark a route as public — skips JWT validation. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

/**
 * JWT guard — validates Bearer token on every route by default.
 * Routes decorated with @Public() are exempt.
 *
 * Also enforces tenant binding: the JWT's tenantId MUST match the
 * X-Tenant-ID header. This blocks cross-tenant escalation where an
 * authenticated user in tenant A sends X-Tenant-ID: tenant-B to access
 * another tenant's data via @TenantId() — the middleware trusts the
 * header alone, so the check must happen here, after JwtStrategy.validate
 * has populated req.user.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(ctx);
  }

  handleRequest<TUser extends AuthenticatedUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    ctx: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const headerTenantId = req.headers['x-tenant-id'];
    const headerValue =
      typeof headerTenantId === 'string' ? headerTenantId.trim() : undefined;

    if (!headerValue) {
      throw new ForbiddenException('X-Tenant-ID header is required');
    }
    if (headerValue !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return user;
  }
}
