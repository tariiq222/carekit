import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BookingStatus } from "@prisma/client";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { FEATURE_CATALOG } from "@deqah/shared";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { UsageCounterService } from "./usage-counter/usage-counter.service";
import { EPOCH, startOfMonthUTC } from "./usage-counter/period.util";
import { REQUIRE_FEATURE_KEY } from "./feature.decorator";
import { FEATURE_KEY_MAP } from "./feature-key-map";
import { FeatureNotEnabledException } from "./feature-not-enabled.exception";

/** Per-org override decision: FORCE_ON (true) / FORCE_OFF (false) / INHERIT (null). */
type OverrideDecision = boolean | null;

interface CachedFeatures {
  features: Record<string, number | boolean>;
  planSlug: string;
  /** featureKey → override decision; absent key means "not yet looked up". */
  overrides: Map<string, OverrideDecision>;
  expiresAt: number;
}

interface AuthenticatedRequest {
  user?: { organizationId?: string };
}

@Injectable()
export class FeatureGuard implements CanActivate {
  /** Static so external listeners can invalidate without holding a reference to the guard instance. */
  private static readonly sharedCache = new Map<string, CachedFeatures>();
  private readonly cache = FeatureGuard.sharedCache;
  private readonly ttlMs = 60_000;

  /** Invalidate cached features for one organization. */
  static invalidate(organizationId: string): void {
    FeatureGuard.sharedCache.delete(organizationId);
  }

  /** Invalidate ALL cached entries (e.g. after a plan schema change). */
  static invalidateAll(): void {
    FeatureGuard.sharedCache.clear();
  }

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cacheService: SubscriptionCacheService,
    private readonly counters: UsageCounterService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.get<FeatureKey>(
      REQUIRE_FEATURE_KEY,
      ctx.getHandler(),
    );

    // No metadata → permissive
    if (!featureKey) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      // Guard is method-level via @RequireFeature; the class is always
      // protected by JwtGuard. If we get here without req.user it is a
      // programming error (e.g. a future contributor put @RequireFeature
      // on a @Public() route). Fail closed instead of silently reading a
      // CLS fallback tenant.
      throw new UnauthorizedException(
        "Authentication required for feature-gated route",
      );
    }

    const { features, planSlug } = await this.resolveFeatures(organizationId);

    // ── Per-tenant override (Phase 6) ───────────────────────────────────
    // FeatureFlag rows scoped by (organizationId, key) act as overrides:
    //   enabled=true  → FORCE_ON  (allow regardless of plan)
    //   enabled=false → FORCE_OFF (deny regardless of plan)
    //   row absent    → INHERIT   (fall through to Plan.limits)
    // Override rows are written via UpsertFeatureFlagOverrideHandler, which
    // emits SUBSCRIPTION_UPDATED_EVENT — CacheInvalidatorListener clears
    // this guard's per-org cache on that event, so override changes
    // propagate within one event-delivery cycle.
    const override = await this.resolveOverride(organizationId, featureKey);
    if (override === true) return true;
    if (override === false) {
      throw new FeatureNotEnabledException(featureKey, planSlug);
    }

    const jsonKey = FEATURE_KEY_MAP[featureKey];
    const value = features[jsonKey];

    // On/off boolean flag
    if (typeof value === "boolean") {
      if (value === false) {
        throw new FeatureNotEnabledException(featureKey, planSlug);
      }
      return true;
    }

    // Quantitative flag (limit stored as number; -1 = unlimited)
    if (typeof value === "number") {
      if (value === -1) return true;
      const current = await this.currentUsage(featureKey, organizationId);
      if (current >= value) {
        throw new ForbiddenException(
          `Feature limit reached for '${featureKey}': ${current}/${value}`,
        );
      }
      return true;
    }

    // ── Default DENY for missing boolean keys (Phase 1 / Bug B3) ────────
    // We reach here when features[jsonKey] is undefined (key not in the
    // plan's seeded limits). Historically the guard fell through to
    // `return true`, silently exposing PRO/ENTERPRISE features on plans
    // that hadn't been seeded with the new key. For boolean-kind catalog
    // entries we now fail closed.
    //
    // Exceptions to fail-closed:
    //   • No subscription found at all (planSlug === "" + empty features
    //     map): keep the existing fail-open posture so unauthenticated
    //     fixtures and orgs without billing data are not blanket-blocked.
    //     Callers in production always have a Subscription via trial/seed.
    //   • Quantitative-kind keys missing from limits: keep permissive
    //     (legacy behavior) — seeds always include the maxX keys, so this
    //     branch is effectively dead code in production.
    //   • Unknown feature keys (not in FEATURE_CATALOG): treat as allow
    //     so a future caller writing @RequireFeature with a custom key
    //     does not silently crash.
    if (planSlug === "" && Object.keys(features).length === 0) {
      return true;
    }

    const catalogEntry = FEATURE_CATALOG[featureKey];
    if (catalogEntry && catalogEntry.kind === "boolean") {
      throw new FeatureNotEnabledException(featureKey, planSlug);
    }

    return true;
  }

  private async resolveFeatures(
    organizationId: string,
  ): Promise<{ features: Record<string, number | boolean>; planSlug: string }> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return { features: cached.features, planSlug: cached.planSlug };
    }

    const sub = await this.cacheService.get(organizationId);
    if (!sub) {
      // No subscription found — cache an empty shell so the override map
      // benefits from per-org cache reuse within the TTL.
      const emptyEntry: CachedFeatures = {
        features: {},
        planSlug: "",
        overrides: new Map(),
        expiresAt: Date.now() + this.ttlMs,
      };
      this.cache.set(organizationId, emptyEntry);
      return { features: {}, planSlug: "" };
    }

    const entry: CachedFeatures = {
      features: sub.limits,
      planSlug: sub.planSlug,
      overrides: new Map(),
      expiresAt: Date.now() + this.ttlMs,
    };
    this.cache.set(organizationId, entry);
    return { features: entry.features, planSlug: entry.planSlug };
  }

  /**
   * Returns the override decision for (organizationId, featureKey):
   *   true   → FORCE_ON  (allow)
   *   false  → FORCE_OFF (deny)
   *   null   → INHERIT   (no override; defer to Plan.limits)
   *
   * Memoized inside the existing per-org cache entry. The whole entry is
   * dropped by FeatureGuard.invalidate(orgId) on
   * SUBSCRIPTION_UPDATED_EVENT — UpsertFeatureFlagOverrideHandler emits
   * that event after every write, so override changes propagate within
   * a single event-delivery cycle.
   */
  private async resolveOverride(
    organizationId: string,
    featureKey: FeatureKey,
  ): Promise<OverrideDecision> {
    const entry = this.cache.get(organizationId);
    if (entry) {
      const cached = entry.overrides.get(featureKey);
      if (cached !== undefined) return cached;
    }

    // Use the scoped Prisma client — the tenant-scoping extension will
    // verify the organizationId we filter on matches the CLS tenant
    // context set by JwtGuard / TenantResolverMiddleware. Cross-tenant
    // leak is impossible: any mismatch throws UnauthorizedTenantAccessError.
    const row = await this.prisma.featureFlag.findFirst({
      where: { organizationId, key: featureKey },
      select: { enabled: true },
    });

    const decision: OverrideDecision = row ? row.enabled : null;

    if (entry) {
      entry.overrides.set(featureKey, decision);
    }
    return decision;
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
    const computed = await this.recomputeFromSource(key, organizationId, period);
    await this.counters.upsertExact(organizationId, key, period, computed);
    return computed;
  }

  /**
   * Recompute the ground-truth usage from the source tables.
   * Kept separate so the self-heal path and reconciliation cron can share it.
   */
  private async recomputeFromSource(
    key: FeatureKey,
    organizationId: string,
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
