import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from '../subscription-cache.service';

@Injectable()
export class ExpireTrialsCron {
  private readonly logger = new Logger(ExpireTrialsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const now = new Date();

    const expiredOrgs = await this.prisma.organization.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lt: now },
      },
      select: { id: true },
    });

    if (expiredOrgs.length === 0) return;

    const orgIds = expiredOrgs.map((o) => o.id);

    await this.prisma.organization.updateMany({
      where: { id: { in: orgIds } },
      data: { status: 'PAST_DUE' },
    });

    await this.prisma.subscription.updateMany({
      where: { organizationId: { in: orgIds }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: now },
    });

    for (const { id } of expiredOrgs) {
      this.cache.invalidate(id);
    }

    this.logger.log(`Transitioned ${orgIds.length} expired trials to PAST_DUE`);
  }
}
