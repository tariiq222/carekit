import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UsageAggregatorService } from '../usage-aggregator.service';

@Injectable()
export class MeterUsageCron {
  private readonly logger = new Logger(MeterUsageCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly aggregator: UsageAggregatorService,
  ) {}

  async execute(): Promise<void> {
    if (!this.config.get<boolean>('BILLING_CRON_ENABLED', false)) return;

    const flushed = this.aggregator.flush();
    if (flushed.length === 0) return;

    // Group by org
    const byOrg = new Map<string, { metric: string; count: number }[]>();
    for (const row of flushed) {
      if (!byOrg.has(row.organizationId)) byOrg.set(row.organizationId, []);
      byOrg.get(row.organizationId)!.push({ metric: row.metric, count: row.count });
    }

    for (const [organizationId, metrics] of byOrg.entries()) {
      const sub = await this.prisma.subscription.findFirst({
        where: { organizationId, status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] } },
      });
      if (!sub) continue;

      for (const { metric, count } of metrics) {
        await this.prisma.usageRecord.upsert({
          where: {
            subscriptionId_metric_periodStart: {
              subscriptionId: sub.id,
              metric: metric as never,
              periodStart: sub.currentPeriodStart,
            },
          },
          update: { count: { increment: count } },
          create: {
            organizationId,
            subscriptionId: sub.id,
            metric: metric as never,
            count,
            periodStart: sub.currentPeriodStart,
            periodEnd: sub.currentPeriodEnd,
          },
        });
      }
    }

    this.logger.log(`Metered usage for ${byOrg.size} orgs`);
  }
}
