import { Injectable } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/**
 * Thin data-access layer for UsageCounter rows.
 *
 * All methods bypass CLS tenant scoping via prisma.$allTenants because
 * listeners run in an async event context that may not have a CLS store.
 * The organizationId is always passed explicitly — defense-in-depth.
 */
@Injectable()
export class UsageCounterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically increment a counter by `by` (default 1).
   * Creates the row if it does not exist yet.
   */
  async increment(
    orgId: string,
    featureKey: FeatureKey,
    periodStart: Date,
    by = 1,
  ): Promise<void> {
    await this.prisma.$allTenants.usageCounter.upsert({
      where: {
        organizationId_featureKey_periodStart: {
          organizationId: orgId,
          featureKey,
          periodStart,
        },
      },
      update: { value: { increment: by } },
      create: {
        organizationId: orgId,
        featureKey,
        periodStart,
        value: by,
      },
    });
  }

  /**
   * Overwrite the counter to an exact value (used by self-heal + reconciliation).
   */
  async upsertExact(
    orgId: string,
    featureKey: FeatureKey,
    periodStart: Date,
    value: number,
  ): Promise<void> {
    await this.prisma.$allTenants.usageCounter.upsert({
      where: {
        organizationId_featureKey_periodStart: {
          organizationId: orgId,
          featureKey,
          periodStart,
        },
      },
      update: { value },
      create: {
        organizationId: orgId,
        featureKey,
        periodStart,
        value,
      },
    });
  }

  /**
   * Read the current counter value. Returns null if no row exists yet.
   */
  async read(
    orgId: string,
    featureKey: FeatureKey,
    periodStart: Date,
  ): Promise<number | null> {
    const row = await this.prisma.$allTenants.usageCounter.findUnique({
      where: {
        organizationId_featureKey_periodStart: {
          organizationId: orgId,
          featureKey,
          periodStart,
        },
      },
      select: { value: true },
    });
    return row?.value ?? null;
  }
}
