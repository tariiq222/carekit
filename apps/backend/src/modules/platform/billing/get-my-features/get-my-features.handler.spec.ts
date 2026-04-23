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
 *  - Priority: orgOverride > platformFlag > plan limits derivation.
 *  - allowedPlans: empty array means "unrestricted" (all plans).
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
    featureFlag: {
      findMany: jest.fn().mockResolvedValue([]),
    },
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

/**
 * Minimal FeatureFlag DB record shape — mirrors the Prisma select in the handler.
 */
function makePlatformFlag(
  key: string,
  enabled: boolean,
  allowedPlans: string[] = [],
) {
  return {
    id: `flag-${key}`,
    organizationId: null, // platform-level flag
    key,
    enabled,
    allowedPlans,
    limitKind: null,
  };
}

function makeOrgOverride(key: string, enabled: boolean, orgId = ORG_ID) {
  return {
    id: `override-${key}`,
    organizationId: orgId,
    key,
    enabled,
    allowedPlans: [],
    limitKind: null,
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GetMyFeaturesHandler', () => {
  // ── 1. Happy path — Active PRO subscription, no DB feature-flag overrides ──

  describe('happy path — PRO subscription, no DB flag overrides', () => {
    it('should return correct planSlug and status', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
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
      );

      const result = await handler.execute();

      // PRO_LIMITS.recurring_bookings = true → no DB flag → derived from limits
      expect(result.features['recurring_bookings']).toMatchObject({
        enabled: true,
      });
    });

    it('should disable advanced_reports (ENTERPRISE-only, false in PRO limits)', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
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
      );

      await handler.execute();

      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
    });
  });

  // ── 2. Org override wins over platform flag ─────────────────────────────────

  describe('org override wins over platform flag', () => {
    it('should enable feature when org override is true, even on BASIC plan', async () => {
      const prisma = buildPrisma();

      // Platform flag says ai_chatbot is off (no allowedPlans, enabled: false)
      const platformFlag = makePlatformFlag('ai_chatbot', false);
      // Org override explicitly enables it for this org
      const orgOverride = makeOrgOverride('ai_chatbot', true);

      prisma.featureFlag.findMany.mockResolvedValue([platformFlag, orgOverride]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('BASIC', BASIC_LIMITS)) as never,
      );

      const result = await handler.execute();

      // Org override takes precedence over platform flag
      expect(result.features['ai_chatbot']).toMatchObject({ enabled: true });
    });

    it('should disable feature when org override is false, even if platform flag is enabled', async () => {
      const prisma = buildPrisma();

      // Platform flag: waitlist enabled for all plans
      const platformFlag = makePlatformFlag('waitlist', true, []);
      // Org override: waitlist disabled for this specific org
      const orgOverride = makeOrgOverride('waitlist', false);

      prisma.featureFlag.findMany.mockResolvedValue([platformFlag, orgOverride]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
      );

      const result = await handler.execute();

      // Org override wins: disabled regardless of platform flag
      expect(result.features['waitlist']).toMatchObject({ enabled: false });
    });

    it('should not use another org override — only matches current organizationId', async () => {
      const prisma = buildPrisma();

      // Override belongs to a DIFFERENT org
      const foreignOverride = makeOrgOverride('ai_chatbot', true, 'org-other-999');
      prisma.featureFlag.findMany.mockResolvedValue([foreignOverride]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant(ORG_ID) as never,
        buildCache(makeCached('BASIC', BASIC_LIMITS)) as never,
      );

      const result = await handler.execute();

      // Foreign override filtered out → falls back to plan limits (BASIC: false)
      expect(result.features['ai_chatbot']).toMatchObject({ enabled: false });
    });
  });

  // ── 3. No subscription → BASIC/TRIALING fallback ───────────────────────────

  describe('no subscription found in cache', () => {
    it('should return BASIC/TRIALING with empty features map', async () => {
      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant() as never,
        buildCache(null) as never, // cache.get returns null → no subscription
      );

      const result = await handler.execute();

      expect(result).toEqual({
        planSlug: 'BASIC',
        status: 'TRIALING',
        features: {},
      });
    });

    it('should short-circuit and not call featureFlag.findMany when cache is null', async () => {
      const prisma = buildPrisma();

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(null) as never,
      );

      await handler.execute();

      // Handler returns early before any DB queries
      expect(prisma.featureFlag.findMany).not.toHaveBeenCalled();
      expect(prisma.branch.count).not.toHaveBeenCalled();
      expect(prisma.employee.count).not.toHaveBeenCalled();
    });

    it('should call cache.get with the correct organizationId', async () => {
      const cache = buildCache(null);

      const handler = new GetMyFeaturesHandler(
        buildPrisma() as never,
        buildTenant('org-abc') as never,
        cache as never,
      );

      await handler.execute();

      expect(cache.get).toHaveBeenCalledWith('org-abc');
    });
  });

  // ── 4. Quantitative features include currentCount ──────────────────────────

  describe('quantitative features — currentCount accuracy', () => {
    it('should attach limit and currentCount for maxEmployees', async () => {
      const prisma = buildPrisma();
      prisma.employee.count.mockResolvedValue(5);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
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
      );

      const result = await handler.execute();

      // recurring_bookings is boolean → no limit/currentCount properties
      const entry = result.features['recurring_bookings'];
      expect(entry).toBeDefined();
      expect(entry.limit).toBeUndefined();
      expect(entry.currentCount).toBeUndefined();
    });
  });

  // ── 5. allowedPlans filtering ───────────────────────────────────────────────

  describe('allowedPlans filtering on platform flags', () => {
    it('should disable feature when current plan is NOT in allowedPlans', async () => {
      const prisma = buildPrisma();

      // Platform flag: enabled=true but restricted to PRO and ENTERPRISE
      prisma.featureFlag.findMany.mockResolvedValue([
        makePlatformFlag('advanced_reports', true, ['PRO', 'ENTERPRISE']),
      ]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        // BASIC is not in ['PRO', 'ENTERPRISE']
        buildCache(makeCached('BASIC', BASIC_LIMITS)) as never,
      );

      const result = await handler.execute();

      expect(result.features['advanced_reports']).toMatchObject({ enabled: false });
    });

    it('should enable feature when current plan IS in allowedPlans', async () => {
      const prisma = buildPrisma();

      prisma.featureFlag.findMany.mockResolvedValue([
        makePlatformFlag('advanced_reports', true, ['PRO', 'ENTERPRISE']),
      ]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
      );

      const result = await handler.execute();

      // PRO ∈ ['PRO', 'ENTERPRISE'] → enabled
      expect(result.features['advanced_reports']).toMatchObject({ enabled: true });
    });

    it('should enable feature when allowedPlans is empty (unrestricted to all plans)', async () => {
      const prisma = buildPrisma();

      // Empty allowedPlans = no restriction — all plans get the feature
      prisma.featureFlag.findMany.mockResolvedValue([
        makePlatformFlag('recurring_bookings', true, []),
      ]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('BASIC', BASIC_LIMITS)) as never,
      );

      const result = await handler.execute();

      // BASIC is allowed because allowedPlans is empty (length === 0 → pass)
      expect(result.features['recurring_bookings']).toMatchObject({ enabled: true });
    });

    it('should disable when platform flag enabled=false regardless of allowedPlans', async () => {
      const prisma = buildPrisma();

      // Platform flag: enabled=false, allowedPlans is unrestricted — but still off
      prisma.featureFlag.findMany.mockResolvedValue([
        makePlatformFlag('coupons', false, []),
      ]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
      );

      const result = await handler.execute();

      // enabled=false in DB → disabled even if plan has it
      expect(result.features['coupons']).toMatchObject({ enabled: false });
    });

    it('should fall back to plan limits derivation when no platform flag exists for a key', async () => {
      const prisma = buildPrisma();
      // findMany returns nothing — no platform flags, no org overrides
      prisma.featureFlag.findMany.mockResolvedValue([]);

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
      );

      const result = await handler.execute();

      // No flag → derived from limits: PRO_LIMITS.email_templates = true
      expect(result.features['email_templates']).toMatchObject({ enabled: true });
    });
  });

  // ── 6. Promise.all parallelism — no N+1 on quantitative counts ─────────────

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
      );

      const execPromise = handler.execute();

      /**
       * Flush microtask queue through the two async steps that precede Promise.all:
       *   Tick 1 → cache.get (mockResolvedValue) resolves; handler advances to findMany.
       *   Tick 2 → featureFlag.findMany resolves; handler enters the Promise.all block
       *            and calls all five currentUsage() callbacks synchronously via map().
       *   Tick 3 → safety buffer for any extra microtask wrapping.
       */
      await Promise.resolve(); // tick 1
      await Promise.resolve(); // tick 2
      await Promise.resolve(); // tick 3 (safety)

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

    it('should call featureFlag.findMany with all feature keys at once (single round-trip)', async () => {
      const prisma = buildPrisma();

      const handler = new GetMyFeaturesHandler(
        prisma as never,
        buildTenant() as never,
        buildCache(makeCached('PRO', PRO_LIMITS)) as never,
      );

      await handler.execute();

      // One single findMany call — not one per feature key
      expect(prisma.featureFlag.findMany).toHaveBeenCalledTimes(1);

      const [call] = prisma.featureFlag.findMany.mock.calls;
      const where = call[0]?.where;

      // The `in` list must include all feature keys (spot-check key members)
      expect(where.key.in).toEqual(
        expect.arrayContaining([
          'recurring_bookings',
          'ai_chatbot',
          'advanced_reports',
          'branches',
          'employees',
          'storage',
        ]),
      );
    });
  });
});
