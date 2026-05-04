import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { LaunchFlags } from '../feature-flags/launch-flags';

export interface OverageLine {
  metric: string;
  included: number;
  used: number;
  overage: number;
  rate: number;
  amount: number;
}

interface MetricConfig {
  metric: string;
  limitKey: string;
  rateKey: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { metric: 'BOOKINGS_PER_MONTH', limitKey: 'maxBookingsPerMonth', rateKey: 'overageRateBookings' },
  { metric: 'CLIENTS', limitKey: 'maxClients', rateKey: 'overageRateClients' },
];

@Injectable()
export class ComputeOverageCron {
  private readonly logger = new Logger(ComputeOverageCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: LaunchFlags,
  ) {}

  async computeForSubscription(params: {
    subscriptionId: string;
    organizationId: string;
    periodStart: Date;
    limits: Record<string, number | boolean>;
    planVersionLimits?: Record<string, number | boolean>;
  }): Promise<{ lines: OverageLine[]; totalOverage: number }> {
    const lines: OverageLine[] = [];
    let totalOverage = 0;

    const limitSource =
      this.flags.planVersioningEnabled && params.planVersionLimits
        ? params.planVersionLimits
        : params.limits;

    for (const { metric, limitKey, rateKey } of METRIC_CONFIGS) {
      const included = Number(limitSource[limitKey] ?? 0);
      if (included === -1) continue; // unlimited, no overage

      const record = await this.prisma.usageRecord.findFirst({
        where: {
          subscriptionId: params.subscriptionId,
          metric: metric as never,
          periodStart: params.periodStart,
        },
      });
      const used = record?.count ?? 0;
      const overage = Math.max(0, used - included);
      const rate = Number(limitSource[rateKey] ?? 0);

      const amount = parseFloat((overage * rate).toFixed(2));

      if (overage > 0) {
        lines.push({ metric, included, used, overage, rate, amount });
        totalOverage += amount;
      }
    }

    this.logger.debug(
      `Overage for sub ${params.subscriptionId}: ${lines.length} lines, total ${totalOverage} SAR`,
    );

    return { lines, totalOverage: parseFloat(totalOverage.toFixed(2)) };
  }
}
