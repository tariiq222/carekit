import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class CancelScheduledDowngradeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationId();
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      select: { id: true, scheduledPlanId: true },
    });
    if (!subscription?.scheduledPlanId) {
      throw new BadRequestException('No scheduled downgrade');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
      },
    });
    this.cache.invalidate(organizationId);
    return updated;
  }
}
