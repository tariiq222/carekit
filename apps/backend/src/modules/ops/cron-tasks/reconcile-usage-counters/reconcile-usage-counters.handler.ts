import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UsageCounterService } from '../../../platform/billing/usage-counter/usage-counter.service';
import { EPOCH, startOfMonthUTC } from '../../../platform/billing/usage-counter/period.util';
import { QUANTITATIVE_KEYS } from '../../../platform/billing/get-usage/get-usage.handler';

/**
 * Daily reconciliation handler.
 *
 * Scans every active/trialing organization and re-derives the ground-truth
 * value for each quantitative usage key from source tables. When the stored
 * counter drifts from truth the counter is corrected and the discrepancy is
 * logged at WARN so on-call can audit.
 *
 * Runs outside CLS tenant context → all DB calls use `prisma.$allTenants`.
 */
@Injectable()
export class ReconcileUsageCountersHandler {
  private readonly logger = new Logger(ReconcileUsageCountersHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: UsageCounterService,
  ) {}

  async execute(): Promise<{ orgsScanned: number; rowsRepaired: number }> {
    const orgs = await this.prisma.$allTenants.organization.findMany({
      where: { status: { in: ['TRIALING', 'ACTIVE'] } },
      select: { id: true },
    });

    let repaired = 0;

    for (const { id: orgId } of orgs) {
      for (const key of QUANTITATIVE_KEYS) {
        const period = key === FeatureKey.MONTHLY_BOOKINGS ? startOfMonthUTC() : EPOCH;

        try {
          const truth = await this.recomputeFromSource(orgId, key, period);
          const stored = await this.counters.read(orgId, key, period);

          if (stored !== truth) {
            await this.counters.upsertExact(orgId, key, period, truth);
            this.logger.warn(
              { orgId, key, stored, truth },
              'usage_counter_drift_repaired',
            );
            repaired++;
          }
        } catch (err: unknown) {
          this.logger.error({ err, orgId, key }, 'usage_counter_reconcile_error');
        }
      }
    }

    this.logger.log(
      { orgsScanned: orgs.length, rowsRepaired: repaired },
      'usage_counter_reconcile_complete',
    );

    return { orgsScanned: orgs.length, rowsRepaired: repaired };
  }

  private async recomputeFromSource(
    organizationId: string,
    key: FeatureKey,
    _period: Date,
  ): Promise<number> {
    switch (key) {
      case FeatureKey.BRANCHES:
        return this.prisma.branch.count({
          where: { organizationId, isActive: true },
        });
      case FeatureKey.EMPLOYEES:
        return this.prisma.employee.count({ where: { organizationId } });
      case FeatureKey.SERVICES:
        return this.prisma.service.count({
          where: { organizationId, isActive: true },
        });
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
