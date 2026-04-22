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
    const req = ctx.switchToHttp().getRequest<{ user?: { organizationId?: string } }>();
    await this.assertOrganizationIsActive(req.user?.organizationId);
    return activated as boolean;
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
}
