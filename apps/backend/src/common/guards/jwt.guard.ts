import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache';
import { TenantContextService } from '../tenant/tenant-context.service';

export const IS_PUBLIC_KEY = 'isPublic';
const ORG_SUSPENSION_CACHE_TTL_SECONDS = 30;
const ACTIVE_ORG_CACHE_SENTINEL = 'active';

/** Mark a route as public — skips JWT validation. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * JWT guard — validates Bearer token on every route by default.
 * Routes decorated with @Public() are exempt.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) return true;

    const activated = await Promise.resolve(super.canActivate(ctx));
    const req = ctx.switchToHttp().getRequest<{
      user?: {
        id?: string;
        sub?: string;
        organizationId?: string;
        membershipId?: string;
        role?: string;
        isSuperAdmin?: boolean;
        scope?: string;
        impersonationSessionId?: string;
      };
    }>();
    this.stampTenantContext(req.user);
    await this.assertOrganizationIsActive(req.user?.organizationId);
    await this.assertImpersonationSessionIsLive(req.user);
    return activated as boolean;
  }

  // SaaS-05b — shadow JWTs (scope='impersonation') are valid only as long
  // as the corresponding ImpersonationSession is active in the DB and not
  // explicitly revoked in Redis. The shadow JWT itself is short-lived
  // (15 min) but a super-admin can end the session manually before that
  // TTL elapses; this check enforces that immediately.
  async assertImpersonationSessionIsLive(user?: {
    scope?: string;
    impersonationSessionId?: string;
  }): Promise<void> {
    if (user?.scope !== 'impersonation') return;
    if (!user.impersonationSessionId) {
      throw new UnauthorizedException('IMPERSONATION_INVALID');
    }

    const redis = this.redis.getClient();
    const revoked = await redis.get(
      `impersonation-revoked:${user.impersonationSessionId}`,
    );
    if (revoked) throw new UnauthorizedException('IMPERSONATION_REVOKED');

    const session = await this.prisma.impersonationSession.findUnique({
      where: { id: user.impersonationSessionId },
      select: { endedAt: true, expiresAt: true },
    });
    if (!session) throw new UnauthorizedException('IMPERSONATION_INVALID');
    if (session.endedAt) throw new UnauthorizedException('IMPERSONATION_ENDED');
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('IMPERSONATION_EXPIRED');
    }
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }

  async assertOrganizationIsActive(organizationId?: string): Promise<void> {
    if (!organizationId) return;

    const redis = this.redis.getClient();
    const key = this.buildOrgSuspensionCacheKey(organizationId);
    const cached = await redis.get(key);

    if (cached === ACTIVE_ORG_CACHE_SENTINEL) return;
    if (cached) {
      throw new UnauthorizedException('ORG_SUSPENDED');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { suspendedAt: true },
    });

    const cacheValue = organization?.suspendedAt?.toISOString() ?? ACTIVE_ORG_CACHE_SENTINEL;
    await redis.set(key, cacheValue, 'EX', ORG_SUSPENSION_CACHE_TTL_SECONDS);

    if (organization?.suspendedAt) {
      throw new UnauthorizedException('ORG_SUSPENDED');
    }
  }

  private buildOrgSuspensionCacheKey(organizationId: string): string {
    return `org-suspension:${organizationId}`;
  }

  private stampTenantContext(user?: {
    id?: string;
    sub?: string;
    organizationId?: string;
    membershipId?: string;
    role?: string;
    isSuperAdmin?: boolean;
  }): void {
    if (!user?.organizationId) return;

    this.tenantContext.set({
      organizationId: user.organizationId,
      membershipId: user.membershipId ?? '',
      id: user.id ?? user.sub ?? '',
      role: user.role ?? '',
      isSuperAdmin: user.isSuperAdmin === true,
    });
  }
}
