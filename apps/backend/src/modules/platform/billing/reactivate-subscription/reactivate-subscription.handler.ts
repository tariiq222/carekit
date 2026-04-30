import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ReactivateSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
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
    return updated;
  }
}
