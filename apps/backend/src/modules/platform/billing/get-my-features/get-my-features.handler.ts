import { Injectable } from "@nestjs/common";
import type { SubscriptionStatus } from "@prisma/client";
import { BookingStatus } from "@prisma/client";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TenantContextService } from "../../../../common/tenant/tenant-context.service";
import { SubscriptionCacheService } from "../subscription-cache.service";
import { UsageCounterService } from "../usage-counter/usage-counter.service";
import { EPOCH, startOfMonthUTC } from "../usage-counter/period.util";
import { BillingFeaturesResponse, FeatureEntry } from "./get-my-features.dto";
import { ALL_FEATURE_KEYS, FEATURE_KEY_MAP } from "../feature-key-map";

interface PlanLimits {
  [key: string]: number | boolean;
}

@Injectable()
export class GetMyFeaturesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly counters: UsageCounterService,
  ) {}

  async execute(): Promise<BillingFeaturesResponse> {
    const organizationId = this.tenant.requireOrganizationId();

    // 1. Load subscription from cache
    const cached = await this.cache.get(organizationId);
    if (!cached) {
      // Orgs without an active subscription default to the platform-configured
      // free/entry tier — the slug is now arbitrary (configurable) so we no
      // longer hardcode "BASIC". If the configured plan is missing, callers
      // still get a valid shape; a later request after seeding recovers.
      return {
        planSlug: process.env.PLATFORM_DEFAULT_PLAN_SLUG ?? "BASIC",
        status: "TRIALING" as SubscriptionStatus,
        features: {},
      };
    }

    const { planSlug, status, limits } = cached;

    // 2. Resolve quantitative features with Promise.all to avoid N+1
    const quantitativeKeys = ALL_FEATURE_KEYS.filter(
      (key) => typeof (limits as PlanLimits)[FEATURE_KEY_MAP[key]] === "number",
    );
    const counts = await Promise.all(
      quantitativeKeys.map((key) => this.currentUsage(key, organizationId)),
    );
    const countMap = Object.fromEntries(
      quantitativeKeys.map((key, i) => [key, counts[i]]),
    );

    // 3. Build features map
    const features: Record<string, FeatureEntry> = {};

    for (const featureKey of ALL_FEATURE_KEYS) {
      const jsonKey = FEATURE_KEY_MAP[featureKey];
      const planLimitValue = (limits as PlanLimits)[jsonKey];

      // Determine enabled status from Plan.limits only.
      // Plan.limits is the SoT for feature access. Match FeatureGuard's
      // fail-closed posture: missing keys → false (the guard would reject
      // the call anyway via FEATURE_CATALOG; aligning the response prevents
      // UI/guard mismatch).
      const enabled: boolean =
        typeof planLimitValue === "boolean"
          ? planLimitValue
          : typeof planLimitValue === "number"
            ? planLimitValue !== 0
            : false;

      const entry: FeatureEntry = { enabled };

      // If the plan limit is a number, attach pre-fetched count
      if (typeof planLimitValue === "number") {
        entry.limit = planLimitValue;
        entry.currentCount = countMap[featureKey] ?? 0;
      }

      features[jsonKey] = entry;
    }

    return {
      planSlug,
      status,
      features,
    };
  }

  /**
   * Returns the current usage for a quantitative feature key.
   *
   * Strategy:
   * 1. Read from materialized UsageCounter (fast, O(1) index lookup).
   * 2. If no row exists yet, fall back to recomputing from source tables
   *    and upsert the result (self-healing bootstrap).
   */
  private async currentUsage(
    key: FeatureKey,
    organizationId: string,
  ): Promise<number> {
    const period = key === FeatureKey.MONTHLY_BOOKINGS ? startOfMonthUTC() : EPOCH;

    const cached = await this.counters.read(organizationId, key, period);
    if (cached !== null) return cached;

    // Cache miss — recompute from source and write to counter (self-heal).
    const computed = await this.recomputeFromSource(key, organizationId);
    await this.counters.upsertExact(organizationId, key, period, computed);
    return computed;
  }

  private async recomputeFromSource(
    key: FeatureKey,
    organizationId: string,
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
      default:
        return 0;
    }
  }
}
