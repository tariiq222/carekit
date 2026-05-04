import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { EventBusService } from '../../../../infrastructure/events';
import { UsageCounterService } from './usage-counter.service';
import { EPOCH } from './period.util';

interface LifecyclePayload {
  organizationId: string;
}

/**
 * DecrementOnLifecycleListener
 *
 * Phase 1 — when a branch/employee/service is deactivated (toggled isActive=false),
 * the corresponding UsageCounter must decrement so the entity-lifecycle counter
 * stays monotonically aligned with active-entity counts.
 *
 * Conversely, when an entity is reactivated, we increment back.
 *
 * The counter is clamped at 0 inside UsageCounterService.increment — so a
 * decrement on a counter that is already 0 is a safe no-op.
 */
@Injectable()
export class DecrementOnLifecycleListener implements OnModuleInit {
  private readonly logger = new Logger(DecrementOnLifecycleListener.name);

  constructor(
    private readonly counters: UsageCounterService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit(): void {
    this.subscribeDecrement('org-config.branch.deactivated', FeatureKey.BRANCHES);
    this.subscribeIncrement('org-config.branch.reactivated', FeatureKey.BRANCHES);
    this.subscribeDecrement('people.employee.deactivated', FeatureKey.EMPLOYEES);
    this.subscribeIncrement('people.employee.reactivated', FeatureKey.EMPLOYEES);
    this.subscribeDecrement('org-experience.service.deactivated', FeatureKey.SERVICES);
    this.subscribeIncrement('org-experience.service.reactivated', FeatureKey.SERVICES);
  }

  private subscribeDecrement(eventName: string, key: FeatureKey) {
    this.eventBus.subscribe<LifecyclePayload>(eventName, async (envelope) => {
      const { organizationId } = envelope.payload;
      await this.counters
        .increment(organizationId, key, EPOCH, -1)
        .catch((err: unknown) =>
          this.logger.error({ err, organizationId, key }, 'usage_counter_decrement_failed'),
        );
    });
  }

  private subscribeIncrement(eventName: string, key: FeatureKey) {
    this.eventBus.subscribe<LifecyclePayload>(eventName, async (envelope) => {
      const { organizationId } = envelope.payload;
      await this.counters
        .increment(organizationId, key, EPOCH, 1)
        .catch((err: unknown) =>
          this.logger.error({ err, organizationId, key }, 'usage_counter_reincrement_failed'),
        );
    });
  }
}
