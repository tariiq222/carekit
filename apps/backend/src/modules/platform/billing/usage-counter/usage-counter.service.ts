import { Injectable } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/**
 * Thin data-access layer for UsageCounter rows.
 *
 * All methods rely on the caller establishing CLS tenant context.
 * In tenant request flow this is automatic via TenantResolverMiddleware.
 * In system flows (cron, event listeners), the caller must set TENANT_CLS_KEY
 * (preferred) or SYSTEM_CONTEXT_CLS_KEY inside a cls.run() before calling.
 *
 * The organizationId is always passed explicitly in the where clause —
 * defense-in-depth, idempotent with the auto-scoping extension.
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
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.usageCounter.findUnique({
        where: {
          organizationId_featureKey_periodStart: {
            organizationId: orgId,
            featureKey,
            periodStart,
          },
        },
        select: { value: true },
      });

      const currentValue = row?.value ?? 0;
      const newValue = Math.max(0, currentValue + by);

      await tx.usageCounter.upsert({
        where: {
          organizationId_featureKey_periodStart: {
            organizationId: orgId,
            featureKey,
            periodStart,
          },
        },
        update: { value: newValue },
        create: {
          organizationId: orgId,
          featureKey,
          periodStart,
          value: Math.max(0, by),
        },
      });
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
    await this.prisma.usageCounter.upsert({
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
    const row = await this.prisma.usageCounter.findUnique({
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
