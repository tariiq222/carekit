/**
 * Unit tests for GetMyFeaturesHandler
 *
 * Strategy: direct instantiation with hand-rolled mocks — no NestJS TestingModule
 * overhead. Each test creates fresh mocks so there is no shared state leakage.
 *
 * Key facts about the handler that drive test design:
 *  - FEATURE_KEY_MAP maps FeatureKey → Plan.limits JSON key.
 *    Boolean features: the JSON key matches the FeatureKey value string
 *      (e.g. "recurring_bookings", "advanced_reports").
 *    Quantitative features use a different JSON key
 *      (e.g. FeatureKey.BRANCHES → "maxBranches").
 *  - The `features` map in the response is keyed by the JSON key (right-hand
 *    side of FEATURE_KEY_MAP), NOT the FeatureKey enum value.
 *  - Enabled is derived solely from Plan.limits:
 *      boolean true  → enabled
 *      boolean false → disabled
 *      number > 0    → enabled
 *      number === 0  → disabled
 *      missing key   → false (planLimitValue is undefined → !0 = true is wrong, undefined !== 0 → enabled=true... see handler)
 *  - Quantitative currentUsage calls are fired in a single Promise.all.
 */

import { GetMyFeaturesHandler } from './get-my-features.handler';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ORG_ID = 'org-123';

/**
 * PRO plan limits JSON — mirrors realistic seed data.
 *
 * Boolean true  → feature is active on PRO.
 * Boolean false → ENTERPRISE-only or not included.
 * number        → quantitative cap for this plan tier.
 */
const PRO_LIMITS: Record<string, number | boolean> = {
  // On/Off — included in PRO
  recurring_bookings: true,
  waitlist: true,
  group_sessions: true,
  ai_chatbot: false,
  email_templates: true,
  coupons: true,
  // On/Off — ENTERPRISE only → false on PRO
  advanced_reports: false,
  intake_forms: false,
  zatca: false,
  custom_roles: false,
  activity_log: false,
  // Quantitative limits
  maxBranches: 3,
  maxEmployees: 20,
  maxServices: 50,
  maxBookingsPerMonth: 500,
  maxStorageMB: 5120,
};

const BASIC_LIMITS: Record<string, number | boolean> = {
  recurring_bookings: false,
  waitlist: false,
  group_sessions: false,
  ai_chatbot: false,
  email_templates: false,
  coupons: false,
  advanced_reports: false,
  intake_forms: false,
  zatca: false,
  custom_roles: false,
  activity_log: false,
  maxBranches: 1,
  maxEmployees: 3,
  maxServices: 5,
  maxBookingsPerMonth: 50,
  maxStorageMB: 100,
};

// ─── Mock builders ────────────────────────────────────────────────────────────

/**
 * Builds a fresh Prisma partial mock covering every table touched by
 * GetMyFeaturesHandler. All counts default to 0; override per-test as needed.
 */
function buildPrisma() {
  return {
    branch: {
      count: jest.fn().mockResolvedValue(0),
    },
    employee: {
      count: jest.fn().mockResolvedValue(0),
    },
    service: {
      count: jest.fn().mockResolvedValue(0),
    },
    booking: {
      count: jest.fn().mockResolvedValue(0),
    },
    file: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { size: 0 } }),
    },
  };
}

function buildTenant(organizationId = ORG_ID) {
  return {
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
  };
}

/**
 * Cache mock that pre-loads a CachedPlanLimits snapshot.
 * Pass `null` to simulate "no active subscription".
 */
function buildCache(result: unknown = null) {
  return {
    get: jest.fn().mockResolvedValue(result),
  };
}

/**
 * Mock UsageCounterService — returns `counterValue` for read().
 * Default: null (cache miss → triggers self-heal fallback to DB count).
 */
function buildCounters(counterValue: number | null = null) {
  return {
    read: jest.fn().mockResolvedValue(counterValue),
    upsertExact: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Convenience: creates a CachedPlanLimits-compatible object accepted by the
 * handler's cache.get() call.
 */
function makeCached(
  planSlug: string,
  limits: Record<string, number | boolean>,
  status = 'ACTIVE',
) {
  return {
    planSlug,
    status,
    limits,
    expiresAt: Date.now() + 60_000,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GetMyFeaturesHandler', () => {
  // ── 1. Happy path — Active PRO subscription ────────────────────────────────

  describe('happy path — PRO subscription', () => {
    it('should return correct planSlug and status', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result.planSlug).toBe('PRO');
      expect(result.status).toBe('ACTIVE');
    });

    it('should enable recurring_bookings (true in PRO limits)', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      // PRO_LIMITS.recurring_bookings = true → derived from plan limits
      expect(result.features['recurring_bookings']).toMatchObject({
        enabled: true,
      });
    });

    it('should disable advanced_reports (ENTERPRISE-only, false in PRO limits)', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      // PRO_LIMITS.advanced_reports = false → derived from limits
      expect(result.features['advanced_reports']).toMatchObject({
        enabled: false,
      });
    });

    it('should include limit and currentCount for quantitative feature maxBranches', async () => {
      const prisma = buildPrisma();
      // Simulate 1 active branch exists for this org
      prisma.branch.count.mockResolvedValue(1);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      // Features map key = JSON key from FEATURE_KEY_MAP = "maxBranches"
      expect(result.features['maxBranches']).toMatchObject({
        enabled: true, // limit > 0 → enabled
        limit: 3,
        currentCount: 1,
      });
    });

    it('should scope branch.count query to organizationId and isActive', async () => {
      const prisma = buildPrisma();

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      await handler.execute();

      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
    });
  });

  // ── 2. No subscription → BASIC/TRIALING fallback ───────────────────────────

  describe('no subscription found in cache', () => {
    it('should return BASIC/TRIALING with empty features map', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(null) as never, // cache.get returns null → no subscription
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result).toEqual({
        planSlug: 'BASIC',
        status: 'TRIALING',
        features: {},
      });
    });

    it('should short-circuit and not call any DB count when cache is null', async () => {
      const prisma = buildPrisma();

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(null) as never,
        buildCounters() as never,
      );

      await handler.execute();

      // Handler returns early before any DB queries
      expect(prisma.branch.count).not.toHaveBeenCalled();
      expect(prisma.employee.count).not.toHaveBeenCalled();
    });

    it('should call cache.get with the correct organizationId', async () => {
      const cache = buildCache(null);

      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant('org-abc') as never,
        cache as never,
        buildCounters() as never,
      );

      await handler.execute();

      expect(cache.get).toHaveBeenCalledWith('org-abc');
    });
  });

  // ── 3. Quantitative features include currentCount ──────────────────────────

  describe('quantitative features — currentCount accuracy', () => {
    it('should attach limit and currentCount for maxEmployees', async () => {
      const prisma = buildPrisma();
      prisma.employee.count.mockResolvedValue(5);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result.features['maxEmployees']).toMatchObject({
        enabled: true,
        limit: 20,
        currentCount: 5,
      });
    });

    it('should scope employee.count query to organizationId', async () => {
      const prisma = buildPrisma();

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      await handler.execute();

      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID },
      });
    });

    it('should convert storage bytes to MB (ceiling) for maxStorageMB.currentCount', async () => {
      const prisma = buildPrisma();
      // 1.5 MB = 1,572,864 bytes → Math.ceil(1_572_864 / 1_048_576) = 2
      prisma.file.aggregate.mockResolvedValue({ _sum: { size: 1_572_864 } });

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result.features['maxStorageMB']).toMatchObject({
        enabled: true,
        limit: 5120,
        currentCount: 2,
      });
    });

    it('should return currentCount = 0 when file aggregate returns null size', async () => {
      const prisma = buildPrisma();
      // Prisma returns null for _sum when there are no rows
      prisma.file.aggregate.mockResolvedValue({ _sum: { size: null } });

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result.features['maxStorageMB']).toMatchObject({
        currentCount: 0,
      });
    });

    it('should count non-cancelled bookings in current month for maxBookingsPerMonth', async () => {
      const prisma = buildPrisma();
      prisma.booking.count.mockResolvedValue(42);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      expect(result.features['maxBookingsPerMonth']).toMatchObject({
        enabled: true,
        limit: 500,
        currentCount: 42,
      });

      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: {
          organizationId: ORG_ID,
          scheduledAt: { gte: expect.any(Date) },
          status: { not: 'CANCELLED' },
        },
      });
    });

    it('should not attach limit or currentCount for boolean (on/off) features', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      // recurring_bookings is boolean → no limit/currentCount properties
      const entry = result.features['recurring_bookings'];
      expect(entry).toBeDefined();
      expect(entry.limit).toBeUndefined();
      expect(entry.currentCount).toBeUndefined();
    });
  });

  // ── 4. Promise.all parallelism — no N+1 on quantitative counts ─────────────

  describe('Promise.all parallelism — currentUsage runs in parallel (no N+1)', () => {
    it('should initiate all usage-count calls before any of them resolve', async () => {
      const prisma = buildPrisma();
      const callOrder: string[] = [];

      /**
       * Branch count is deliberately blocked (never-resolving promise until we
       * manually unblock it). If the handler awaited counts sequentially, none
       * of the other counts would ever be called. Because the handler uses
       * Promise.all, all five calls are initiated synchronously inside the map()
       * callback before any await, so they should ALL appear in callOrder before
       * the main promise resolves — even while branch is still pending.
       */
      let unblockBranch!: (n: number) => void;
      prisma.branch.count.mockImplementation(() => {
        callOrder.push('branch');
        return new Promise<number>((res) => {
          unblockBranch = res;
        });
      });

      prisma.employee.count.mockImplementation(() => {
        callOrder.push('employee');
        return Promise.resolve(5);
      });

      prisma.service.count.mockImplementation(() => {
        callOrder.push('service');
        return Promise.resolve(10);
      });

      prisma.booking.count.mockImplementation(() => {
        callOrder.push('booking');
        return Promise.resolve(50);
      });

      prisma.file.aggregate.mockImplementation(() => {
        callOrder.push('file');
        return Promise.resolve({ _sum: { size: 0 } });
      });

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        buildCounters() as never,
      );

      const execPromise = handler.execute();

      /**
       * Flush microtask queue through the async steps that precede Promise.all:
       *   Tick 1 → cache.get (mockResolvedValue) resolves; handler advances to
       *            the Promise.all block and calls all five currentUsage()
       *            callbacks synchronously via map().
       *   Tick 2 → safety buffer for any extra microtask wrapping.
       */
      await Promise.resolve(); // tick 1
      await Promise.resolve(); // tick 2 (safety)

      // ── All five usage calls must already be in-flight ───────────────────────
      expect(callOrder).toHaveLength(5);
      expect(callOrder).toEqual(
        expect.arrayContaining(['branch', 'employee', 'service', 'booking', 'file']),
      );

      // ── Each called exactly once — no duplicate (N+1) queries ────────────────
      expect(prisma.branch.count).toHaveBeenCalledTimes(1);
      expect(prisma.employee.count).toHaveBeenCalledTimes(1);
      expect(prisma.service.count).toHaveBeenCalledTimes(1);
      expect(prisma.booking.count).toHaveBeenCalledTimes(1);
      expect(prisma.file.aggregate).toHaveBeenCalledTimes(1);

      // ── Unblock branch so the Promise.all resolves and handler completes ─────
      unblockBranch(1);
      const result = await execPromise;

      // Sanity: counts are reflected correctly in the final response
      expect(result.features['maxBranches'].currentCount).toBe(1);
      expect(result.features['maxEmployees'].currentCount).toBe(5);
      expect(result.features['maxServices'].currentCount).toBe(10);
      expect(result.features['maxBookingsPerMonth'].currentCount).toBe(50);
    });
  });

  // ── 5. UsageCounter hit/miss paths ────────────────────────────────────────────

  describe('UsageCounter materialized cache paths', () => {
    it('counter hit: should NOT call prisma.employee.count when counter row present', async () => {
      const prisma = buildPrisma();
      // Counter returns 7 for EMPLOYEES — DB should never be called
      const counters = buildCounters(7);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        counters as never,
      );

      const result = await handler.execute();

      expect(prisma.employee.count).not.toHaveBeenCalled();
      expect(result.features['maxEmployees'].currentCount).toBe(7);
    });

    it('counter miss: should call prisma.employee.count and then upsertExact (self-heal)', async () => {
      const prisma = buildPrisma();
      prisma.employee.count.mockResolvedValue(4);
      const counters = buildCounters(null); // cache miss

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
        counters as never,
      );

      const result = await handler.execute();

      expect(prisma.employee.count).toHaveBeenCalledTimes(1);
      expect(counters.upsertExact).toHaveBeenCalledWith(
        ORG_ID,
        'employees',
        expect.any(Date),
        4,
      );
      expect(result.features['maxEmployees'].currentCount).toBe(4);
    });
  });

  // ── 6. Fail-closed: missing Plan.limits key → enabled=false ───────────────

  describe('fail-closed behavior — missing Plan.limits keys', () => {
    it('returns enabled=false for keys absent from Plan.limits (aligns with FeatureGuard)', async () => {
      // Build limits that include every PRO key EXCEPT zoom_integration,
      // so planLimitValue for ZOOM_INTEGRATION is `undefined`.
      const limitsWithoutZoom: Record<string, number | boolean> = {
        recurring_bookings: true,
        waitlist: true,
        group_sessions: true,
        ai_chatbot: false,
        email_templates: true,
        coupons: true,
        advanced_reports: false,
        intake_forms: false,
        zatca: false,
        custom_roles: false,
        activity_log: false,
        maxBranches: 3,
        maxEmployees: 20,
        maxServices: 50,
        maxBookingsPerMonth: 500,
        maxStorageMB: 5120,
        // zoom_integration intentionally omitted → undefined → fail-closed
      };

      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', limitsWithoutZoom)) as never,
        buildCounters() as never,
      );

      const result = await handler.execute();

      // 'zoom_integration' key is absent from limits → handler must return false
      expect(result.features['zoom_integration']).toMatchObject({ enabled: false });
      // Sanity: a key that IS present still works correctly
      expect(result.features['recurring_bookings']).toMatchObject({ enabled: true });
    });
  });
});
