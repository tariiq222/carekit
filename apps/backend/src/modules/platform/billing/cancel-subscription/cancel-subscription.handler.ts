import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionStateMachine } from '../subscription-state-machine';

@Injectable()
export class CancelSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly stateMachine: SubscriptionStateMachine,
  ) {}

  async execute(cmd: { reason?: string }) {
    const organizationId = this.tenant.requireOrganizationId();

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: {
        id: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    });
    if (!sub) throw new NotFoundException('No subscription found');

    if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') {
      if (sub.cancelAtPeriodEnd) {
        throw new ConflictException('subscription_cancellation_already_scheduled');
      }

      const updated = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          cancelAtPeriodEnd: true,
          scheduledCancellationDate: sub.currentPeriodEnd,
          cancelReason: cmd.reason ?? null,
        },
      });
      this.cache.invalidate(organizationId);
      return updated;
    }

    // Throws on illegal immediate cancellation (e.g. CANCELED → cancel)
    this.stateMachine.transition(sub.status, { type: 'cancel' });

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelReason: cmd.reason ?? null,
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
      },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }
}
