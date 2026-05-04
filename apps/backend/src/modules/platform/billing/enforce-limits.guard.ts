import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BookingStatus } from '@prisma/client';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { UsageCounterService } from './usage-counter/usage-counter.service';
import { startOfMonthUTC } from './usage-counter/period.util';
import { ENFORCE_LIMIT_KEY, LimitKind } from './plan-limits.decorator';

interface AuthenticatedRequest {
  user?: { organizationId?: string };
}

/**
 * Pre-create plan-limit guard.
 *
 * For BRANCHES / EMPLOYEES the source of truth is a live `count()` against the
 * domain table — these are tiny tables, the count is cheap and the
 * UsageCounter row may not yet exist (orgs created before SaaS-04).
 *
 * For BOOKINGS_PER_MONTH the domain table can be large (millions of rows for a
 * busy clinic), so we read the materialized UsageCounter row and fall back to a
 * recompute if the row is absent (self-heal). The reconcile cron in
 * `reconcile-usage-counters.handler.ts` keeps these honest.
 */
@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: SubscriptionCacheService,
    private readonly counters: UsageCounterService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.get<LimitKind>(ENFORCE_LIMIT_KEY, ctx.getHandler());
    if (!kind) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException(
        'Authentication required for plan-limited route',
      );
    }

    const cached = await this.cache.get(organizationId);

    // No subscription → allow (dev/trial before billing goes live)
    if (!cached) return true;

    if (cached.status === 'CANCELED' || cached.status === 'SUSPENDED') {
      throw new ForbiddenException(`Subscription is ${cached.status}`);
    }

    const limit = this.resolveLimit(kind, cached.limits);
    if (limit === -1) return true; // unlimited

    const current = await this.currentUsage(kind, organizationId);
    if (current >= limit) {
      const message = `Plan limit reached for ${kind}: ${current}/${limit}`;
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        limitKind: kind,
        current,
        limit,
        message,
      });
    }
    return true;
  }

  private resolveLimit(kind: LimitKind, limits: Record<string, number | boolean>): number {
    switch (kind) {
      case 'BRANCHES': return Number(limits['maxBranches'] ?? 0);
      case 'EMPLOYEES': return Number(limits['maxEmployees'] ?? 0);
      case 'BOOKINGS_PER_MONTH': return Number(limits['maxBookingsPerMonth'] ?? 0);
    }
  }

  private async currentUsage(kind: LimitKind, organizationId: string): Promise<number> {
    switch (kind) {
      case 'BRANCHES':
        return this.prisma.branch.count({ where: { organizationId, isActive: true } });
      case 'EMPLOYEES':
        return this.prisma.employee.count({ where: { organizationId, isActive: true } });
      case 'BOOKINGS_PER_MONTH':
        return this.readCounter(
          organizationId,
          FeatureKey.MONTHLY_BOOKINGS,
          startOfMonthUTC(),
          () => this.recomputeMonthlyBookings(organizationId),
        );
    }
  }

  /**
   * Reads the materialized UsageCounter row; on miss, recomputes from source
   * and writes the row back (self-heal). Mirrors FeatureGuard.currentUsage.
   */
  private async readCounter(
    organizationId: string,
    featureKey: FeatureKey,
    period: Date,
    recompute: () => Promise<number>,
  ): Promise<number> {
    const cached = await this.counters.read(organizationId, featureKey, period);
    if (cached !== null) return cached;
    const computed = await recompute();
    await this.counters.upsertExact(organizationId, featureKey, period, computed);
    return computed;
  }

  private async recomputeMonthlyBookings(organizationId: string): Promise<number> {
    return this.prisma.booking.count({
      where: {
        organizationId,
        scheduledAt: { gte: startOfMonthUTC() },
        status: { not: BookingStatus.CANCELLED },
      },
    });
  }
}
