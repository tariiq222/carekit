import { Injectable } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { BookingStatus } from '@prisma/client';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { UsageCounterService } from '../usage-counter/usage-counter.service';
import { EPOCH, startOfMonthUTC, periodEndUTC } from '../usage-counter/period.util';
import { FEATURE_KEY_MAP } from '../feature-key-map';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UsageRowDto } from './get-usage.dto';

/**
 * The 5 quantitative feature keys that have numeric limits and usage counters.
 */
export const QUANTITATIVE_KEYS: readonly FeatureKey[] = [
  FeatureKey.BRANCHES,
  FeatureKey.EMPLOYEES,
  FeatureKey.SERVICES,
  FeatureKey.MONTHLY_BOOKINGS,
  FeatureKey.STORAGE,
] as const;

@Injectable()
export class GetUsageHandler {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly counters: UsageCounterService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: { organizationId: string }): Promise<UsageRowDto[]> {
    const { organizationId } = cmd;

    // 1. Load plan limits
    const sub = await this.cache.get(organizationId);
    const limits = sub?.limits ?? {};

    // 2. For each quantitative key, read counter (self-heal if missing)
    const rows = await Promise.all(
      QUANTITATIVE_KEYS.map(async (key) => {
        const period = key === FeatureKey.MONTHLY_BOOKINGS ? startOfMonthUTC() : EPOCH;

        // Read materialized counter; fall back to DB if not present.
        let current = await this.counters.read(organizationId, key, period);
        if (current === null) {
          current = await this.recomputeFromSource(key, organizationId);
          await this.counters.upsertExact(organizationId, key, period, current);
        }

        const jsonKey = FEATURE_KEY_MAP[key];
        const limit = typeof limits[jsonKey] === 'number' ? (limits[jsonKey] as number) : -1;
        const percentage = limit < 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));
        const periodEnd = periodEndUTC(period);

        const row = new UsageRowDto();
        row.featureKey = key;
        row.current = current;
        row.limit = limit;
        row.percentage = percentage;
        row.periodEnd = periodEnd;
        return row;
      }),
    );

    return rows;
  }

  private async recomputeFromSource(
    key: FeatureKey,
    organizationId: string,
  ): Promise<number> {
    switch (key) {
      case FeatureKey.BRANCHES:
        return this.prisma.branch.count({ where: { organizationId, isActive: true } });
      case FeatureKey.EMPLOYEES:
        return this.prisma.employee.count({ where: { organizationId } });
      case FeatureKey.SERVICES:
        return this.prisma.service.count({ where: { organizationId, isActive: true } });
      case FeatureKey.MONTHLY_BOOKINGS: {
        const startOfMonth = startOfMonthUTC();
        return this.prisma.booking.count({
          where: {
            organizationId,
            scheduledAt: { gte: startOfMonth },
            status: { not: BookingStatus.CANCELLED },
          },
        });
      }
      case FeatureKey.STORAGE: {
        const result = await this.prisma.file.aggregate({
          where: { organizationId, isDeleted: false },
          _sum: { size: true },
        });
        const bytes = result._sum.size ?? 0;
        return Math.ceil(bytes / (1024 * 1024));
      }
      default:
        return 0;
    }
  }
}
