import { Injectable, Optional } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Plan limits JSON shape (mirrors the seed migration).
 *
 * Every quota is a number. `-1` means unlimited. Feature flags are booleans.
 * Kept as `Record<string, number | boolean>` at the cache boundary so callers
 * are forced to narrow at use-time via `PlanLimitsGuard` / `@TrackUsage()`.
 */
export type PlanLimitsJson = Record<string, number | boolean>;

export interface CachedPlanLimits {
  planSlug: string;
  status: SubscriptionStatus;
  limits: PlanLimitsJson;
  /** Plan version snapshot limits, if the subscription has a planVersionId. */
  planVersionLimits?: PlanLimitsJson;
  /** Monotonic epoch-ms; compared against injected clock. */
  expiresAt: number;
}

/**
 * Injection boundary for the clock — keeps unit tests deterministic without
 * pulling in jest fake timers (which conflict with Nest's TestingModule lifecycle).
 */
export interface Clock {
  now(): number;
}

export const CLOCK = Symbol('SubscriptionCache.Clock');

/**
 * SubscriptionCacheService — in-process TTL cache keyed by organizationId.
 *
 * Why a local Map, not Redis?
 * - PlanLimitsGuard runs on every create-{branch,employee,booking,...} call.
 *   A network roundtrip per request is not acceptable.
 * - The cached value is tiny (≤ 200 bytes) and per-org. TTL is short (60s) so
 *   plan upgrades propagate within one cycle even without explicit invalidation.
 * - Multi-instance correctness is handled by explicit `invalidate(orgId)`
 *   calls on plan/status transitions (emitted by handlers in Task 7).
 *
 * Read path is PLATFORM-level: we read `Subscription` + related `Plan`
 * directly. Although `Subscription` is in SCOPED_MODELS, we intentionally
 * filter by `organizationId` ourselves so this cache is callable from
 * TenantContextService BEFORE the tenant extension has a chance to inject.
 */
@Injectable()
export class SubscriptionCacheService {
  private readonly cache = new Map<string, CachedPlanLimits>();
  private readonly ttlMs: number;
  private readonly clock: Clock;

  constructor(private readonly prisma: PrismaService, @Optional() options?: { ttlMs?: number; clock?: Clock }) {
    this.ttlMs = options?.ttlMs ?? 60_000;
    this.clock = options?.clock ?? { now: () => Date.now() };
  }

  async get(organizationId: string): Promise<CachedPlanLimits | null> {
    const hit = this.cache.get(organizationId);
    if (hit && hit.expiresAt > this.clock.now()) {
      return hit;
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      include: { plan: true, planVersion: true },
    });
    if (!sub) {
      return null;
    }

    const limits = sub.plan.limits as Prisma.JsonObject;
    const narrowed: PlanLimitsJson = {};
    for (const [k, v] of Object.entries(limits)) {
      if (typeof v === 'number' || typeof v === 'boolean') {
        narrowed[k] = v;
      }
    }

    let planVersionLimits: PlanLimitsJson | undefined;
    if (sub.planVersion) {
      const pvLimits = sub.planVersion.limits as Prisma.JsonObject;
      const narrowedPv: PlanLimitsJson = {};
      for (const [k, v] of Object.entries(pvLimits)) {
        if (typeof v === 'number' || typeof v === 'boolean') {
          narrowedPv[k] = v;
        }
      }
      planVersionLimits = narrowedPv;
    }

    const entry: CachedPlanLimits = {
      planSlug: sub.plan.slug,
      status: sub.status,
      limits: narrowed,
      planVersionLimits,
      expiresAt: this.clock.now() + this.ttlMs,
    };
    this.cache.set(organizationId, entry);
    return entry;
  }

  /** Called by handlers after plan changes / status transitions. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  /** Test helper — not part of the production surface but cheap to expose. */
  size(): number {
    return this.cache.size;
  }
}
