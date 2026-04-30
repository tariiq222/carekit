import { Injectable } from "@nestjs/common";
import type { SubscriptionStatus } from "@prisma/client";
import { BookingStatus } from "@prisma/client";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TenantContextService } from "../../../../common/tenant/tenant-context.service";
import { SubscriptionCacheService } from "../subscription-cache.service";
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

    // 2. Fetch all feature flags (platform catalog + org overrides) in one query.
    // We load all flags for the relevant keys and split in JS because the
    // Prisma client types for the nullable `organizationId` field may not yet
    // be regenerated after the schema migration — a `{ equals: null }` filter
    // causes a TS error on stale clients.  One round-trip is also cheaper than
    // two parallel queries.
    const allFlagsForKeys = await this.prisma.featureFlag.findMany({
      where: { key: { in: ALL_FEATURE_KEYS } },
      select: {
        id: true,
        organizationId: true,
        key: true,
        enabled: true,
        allowedPlans: true,
        limitKind: true,
      },
    });
    const platformFlags = allFlagsForKeys.filter(
      (f) => f.organizationId === null,
    );
    const orgOverrides = allFlagsForKeys.filter(
      (f) => f.organizationId === organizationId,
    );

    // Index org overrides by key for O(1) lookup
    const orgOverrideMap = new Map(orgOverrides.map((f) => [f.key, f]));
    // Index platform catalog by key
    const platformFlagMap = new Map(platformFlags.map((f) => [f.key, f]));

    // 3. Resolve quantitative features with Promise.all to avoid N+1
    const quantitativeKeys = ALL_FEATURE_KEYS.filter(
      (key) => typeof (limits as PlanLimits)[FEATURE_KEY_MAP[key]] === "number",
    );
    const counts = await Promise.all(
      quantitativeKeys.map((key) => this.currentUsage(key, organizationId)),
    );
    const countMap = Object.fromEntries(
      quantitativeKeys.map((key, i) => [key, counts[i]]),
    );

    // 4. Build features map
    const features: Record<string, FeatureEntry> = {};

    for (const featureKey of ALL_FEATURE_KEYS) {
      const jsonKey = FEATURE_KEY_MAP[featureKey];
      const planLimitValue = (limits as PlanLimits)[jsonKey];
      const orgOverride = orgOverrideMap.get(featureKey);
      const platformFlag = platformFlagMap.get(featureKey);

      // Determine enabled status
      let enabled: boolean;
      if (orgOverride) {
        enabled = orgOverride.enabled;
      } else if (platformFlag) {
        // Check if the current plan is in allowedPlans.
        // `allowedPlans` may not yet be in the generated Prisma client type
        // (pending regeneration after schema migration), so we reach through
        // `unknown` to avoid a hard TS error while preserving runtime safety.
        const rawFlag = platformFlag as unknown as { allowedPlans?: string[] };
        const allowedPlans: string[] = rawFlag.allowedPlans ?? [];
        enabled =
          platformFlag.enabled &&
          (allowedPlans.length === 0 || allowedPlans.includes(planSlug));
      } else {
        // No feature flag record → derive from plan limits
        enabled =
          typeof planLimitValue === "boolean"
            ? planLimitValue
            : planLimitValue !== 0;
      }

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

  private async currentUsage(
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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
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
        // Convert bytes to MB (ceiling)
        const bytes = result._sum.size ?? 0;
        return Math.ceil(bytes / (1024 * 1024));
      }
      default:
        return 0;
    }
  }
}
