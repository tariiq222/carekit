import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ProcessScheduledPlanChangesCron {
  private readonly logger = new Logger(ProcessScheduledPlanChangesCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();
    const due = await this.prisma.$allTenants.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        scheduledPlanId: { not: null },
        scheduledBillingCycle: { not: null },
        scheduledPlanChangeAt: { lte: now },
      },
      select: {
        id: true,
        organizationId: true,
        scheduledPlanId: true,
        scheduledBillingCycle: true,
      },
    });

    for (const sub of due) {
      if (!sub.scheduledPlanId || !sub.scheduledBillingCycle) continue;
      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: {
          planId: sub.scheduledPlanId,
          billingCycle: sub.scheduledBillingCycle,
          scheduledPlanId: null,
          scheduledBillingCycle: null,
          scheduledPlanChangeAt: null,
        },
      });
      this.cache.invalidate(sub.organizationId);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} scheduled subscription plan changes`);
    }
  }
}
