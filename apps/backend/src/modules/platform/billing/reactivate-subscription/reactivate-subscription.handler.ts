import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { EventBusService } from '../../../../infrastructure/events';
import {
  SUBSCRIPTION_UPDATED_EVENT,
  type SubscriptionUpdatedPayload,
} from '../events/subscription-updated.event';

@Injectable()
export class ReactivateSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationId();
    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        cancelAtPeriodEnd: true,
      },
    });
    if (!sub) throw new NotFoundException('No subscription found');
    if (sub.status === 'CANCELED') {
      throw new BadRequestException('subscription_not_reactivatable');
    }
    if (!sub.cancelAtPeriodEnd) {
      throw new BadRequestException('subscription_cancellation_not_scheduled');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        cancelReason: null,
      },
    });
    this.cache.invalidate(organizationId);

    await this.eventBus
      .publish<SubscriptionUpdatedPayload>(SUBSCRIPTION_UPDATED_EVENT, {
        eventId: `${SUBSCRIPTION_UPDATED_EVENT}:${sub.id}:${Date.now()}`,
        source: 'billing.reactivate-subscription',
        version: 1,
        occurredAt: new Date(),
        payload: { organizationId, subscriptionId: sub.id, reason: 'REACTIVATE' },
      })
      .catch(() => undefined);

    return updated;
  }
}
