import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '../../../infrastructure/events';
import { SubscriptionCacheService } from './subscription-cache.service';
import { FeatureGuard } from './feature.guard';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from './events/subscription-updated.event';
import {
  PLAN_UPDATED_EVENT,
  type PlanUpdatedPayload,
} from './events/plan-updated.event';

/**
 * Listens for billing domain events and invalidates in-process caches so
 * plan/subscription changes propagate to all guard/service reads within ≤ 1 event
 * delivery cycle instead of waiting for TTL expiry.
 *
 * Follows the same EventBusService subscribe pattern as IncrementUsageListener.
 */
@Injectable()
export class CacheInvalidatorListener implements OnModuleInit {
  private readonly logger = new Logger(CacheInvalidatorListener.name);

  constructor(
    private readonly subCache: SubscriptionCacheService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<SubscriptionUpdatedPayload>(
      SUBSCRIPTION_UPDATED_EVENT,
      async (envelope) => {
        const { organizationId } = envelope.payload;
        await this.invalidateOrgs([organizationId]);
      },
    );

    this.eventBus.subscribe<PlanUpdatedPayload>(
      PLAN_UPDATED_EVENT,
      async (envelope) => {
        const { affectedOrganizationIds } = envelope.payload;
        if (affectedOrganizationIds.length === 0) {
          // No known subscribers — still clear FeatureGuard in-process cache entirely
          FeatureGuard.invalidateAll();
          this.logger.log('plan.updated: no affected orgs listed; cleared FeatureGuard entirely');
          return;
        }
        await this.invalidateOrgs(affectedOrganizationIds);
      },
    );
  }

  private async invalidateOrgs(orgIds: string[]): Promise<void> {
    for (const orgId of orgIds) {
      try {
        FeatureGuard.invalidate(orgId);
        this.subCache.invalidate(orgId);
        this.logger.debug({ orgId }, 'cache_invalidated');
      } catch (err: unknown) {
        this.logger.error({ err, orgId }, 'cache_invalidation_failed');
      }
    }
  }
}
