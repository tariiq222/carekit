import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { UsageAggregatorService } from './usage-aggregator.service';
import { TRACK_USAGE_KEY, UsageMetricKind } from './track-usage.decorator';

@Injectable()
export class UsageTrackerInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly aggregator: UsageAggregatorService,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const kind = this.reflector.get<UsageMetricKind>(TRACK_USAGE_KEY, ctx.getHandler());
    if (!kind) return next.handle();

    const organizationId = this.tenant.requireOrganizationId();
    const cached = await this.cache.get(organizationId);

    if (cached?.status === 'SUSPENDED' || cached?.status === 'CANCELED') {
      throw new ForbiddenException(`Subscription is ${cached.status}`);
    }
    // No subscription → allow (dev/trial)

    return next.handle().pipe(
      tap((response) => {
        const delta =
          kind === 'STORAGE_MB'
            ? Math.ceil(Number((response as { sizeBytes?: number })?.sizeBytes ?? 0) / (1024 * 1024))
            : 1;
        if (delta > 0) this.aggregator.increment(organizationId, kind, delta);
      }),
    );
  }
}
