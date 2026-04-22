import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

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
  { metric: 'STORAGE_MB', limitKey: 'maxStorageMB', rateKey: 'overageRateStorageGB' },
];

@Injectable()
export class ComputeOverageCron {
  private readonly logger = new Logger(ComputeOverageCron.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeForSubscription(params: {
    subscriptionId: string;
    organizationId: string;
    periodStart: Date;
    limits: Record<string, number | boolean>;
  }): Promise<{ lines: OverageLine[]; totalOverage: number }> {
    const lines: OverageLine[] = [];
    let totalOverage = 0;

    for (const { metric, limitKey, rateKey } of METRIC_CONFIGS) {
      const included = Number(params.limits[limitKey] ?? 0);
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
      const rate = Number(params.limits[rateKey] ?? 0);

      // STORAGE_MB: rate is per GB, but metric is MB
      const amount =
        metric === 'STORAGE_MB'
          ? parseFloat(((overage / 1024) * rate).toFixed(2))
          : parseFloat((overage * rate).toFixed(2));

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
