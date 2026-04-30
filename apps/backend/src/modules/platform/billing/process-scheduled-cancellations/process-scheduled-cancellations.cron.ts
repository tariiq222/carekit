import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ProcessScheduledCancellationsCron {
  private readonly logger = new Logger(ProcessScheduledCancellationsCron.name);

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
        cancelAtPeriodEnd: true,
        scheduledCancellationDate: { lte: now },
      },
      select: { id: true, organizationId: true },
    });

    for (const sub of due) {
      await this.prisma.$allTenants.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELED',
          canceledAt: now,
          cancelAtPeriodEnd: false,
        },
      });
      this.cache.invalidate(sub.organizationId);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} scheduled subscription cancellations`);
    }
  }
}
