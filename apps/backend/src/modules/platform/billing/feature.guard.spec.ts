import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { FeatureGuard } from "./feature.guard";
import { FeatureNotEnabledException } from "./feature-not-enabled.exception";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { UsageCounterService } from "./usage-counter/usage-counter.service";

const ORG_ID = "org-123";

const MISSING_USER = Symbol("MISSING_USER");

function mockContext(user: { organizationId?: string } | typeof MISSING_USER = { organizationId: ORG_ID }) {
  const request: Record<string, unknown> = user === MISSING_USER ? {} : { user };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue(request) }),
  } as unknown as ExecutionContext;
}

function mockReflector(getValue: jest.Mock) {
  return { get: getValue } as unknown as Reflector;
}

type CacheArg =
  | Record<string, number | boolean>
  | { planSlug: string; limits: Record<string, number | boolean> }
  | null;

function mockCacheService(arg: CacheArg) {
  if (arg === null) {
    return {
      get: jest.fn().mockResolvedValue(null),
    } as unknown as SubscriptionCacheService;
  }
  const isShape = (
    v: NonNullable<CacheArg>,
  ): v is { planSlug: string; limits: Record<string, number | boolean> } =>
    "planSlug" in v && "limits" in v;
  const planSlug = isShape(arg) ? arg.planSlug : "pro";
  const limits = isShape(arg)
    ? arg.limits
    : (arg as Record<string, number | boolean>);
  return {
    get: jest.fn().mockResolvedValue({
      planSlug,
      status: "ACTIVE",
      limits,
      expiresAt: Date.now() + 60_000,
    }),
  } as unknown as SubscriptionCacheService;
}

function mockPrisma(counts: Partial<Record<string, number>>) {
  const base = {
    branch: { count: jest.fn().mockResolvedValue(counts.branches ?? 0) },
    employee: { count: jest.fn().mockResolvedValue(counts.employees ?? 0) },
    service: { count: jest.fn().mockResolvedValue(counts.services ?? 0) },
    booking: { count: jest.fn().mockResolvedValue(counts.bookings ?? 0) },
    file: { aggregate: jest.fn().mockResolvedValue({ _sum: { size: counts.storageBytes ?? 0 } }) },
  };
  return {
    ...base,
    $allTenants: base,
  } as unknown as PrismaService;
}

/**
 * Creates a mock UsageCounterService.
 * @param counterValue - value returned by read(); null = cache miss (triggers fallback).
 */
function mockCounters(counterValue: number | null = null): UsageCounterService {
  return {
    read: jest.fn().mockResolvedValue(counterValue),
    upsertExact: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
  } as unknown as UsageCounterService;
}

function makeGuard(
  reflector: Reflector,
  prisma: PrismaService,
  cacheArg: CacheArg,
  counters?: UsageCounterService,
) {
  return new FeatureGuard(
    reflector,
    prisma,
    mockCacheService(cacheArg),
    counters ?? mockCounters(null),
  );
}

describe("FeatureGuard", () => {
  beforeEach(() => {
    FeatureGuard.invalidateAll();
  });

  describe("no @RequireFeature decorator", () => {
    it("should allow when no RequireFeature metadata", async () => {
      const reflector = mockReflector(jest.fn().mockReturnValue(undefined));
      const guard = makeGuard(reflector, mockPrisma({}), null);
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("on/off feature flags", () => {
    it("should throw ForbiddenException when feature is disabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.AI_CHATBOT),
      );
      const guard = makeGuard(reflector, mockPrisma({}), { ai_chatbot: false });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Feature 'ai_chatbot' is not enabled for your plan",
      );
    });

    it("should allow when feature is enabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.COUPONS),
      );
      const guard = makeGuard(reflector, mockPrisma({}), { coupons: true });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("quantitative limits — UsageCounter hit path", () => {
    it("should allow when counter row present and usage below limit", async () => {
      const counters = mockCounters(5); // counter says 5 employees
      const prisma = mockPrisma({ employees: 99 }); // source DB has 99 (should NOT be called)
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = makeGuard(reflector, prisma, { maxEmployees: 10 }, counters);
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      // Counter hit → no DB count query
      expect(prisma.employee.count).not.toHaveBeenCalled();
      expect(counters.read).toHaveBeenCalledTimes(1);
    });

    it("should throw when counter row present and usage equals limit", async () => {
      const counters = mockCounters(10);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = makeGuard(reflector, mockPrisma({}), { maxEmployees: 10 }, counters);
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("quantitative limits — UsageCounter miss path (self-heal)", () => {
    it("should fall back to count() and upsert when counter row absent", async () => {
      const counters = mockCounters(null); // cache miss
      const prisma = mockPrisma({ employees: 7 });
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = makeGuard(reflector, prisma, { maxEmployees: 10 }, counters);
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      // Fallback: DB count WAS called once
      expect(prisma.employee.count).toHaveBeenCalledTimes(1);
      // Self-heal: upsertExact called with computed value
      expect(counters.upsertExact).toHaveBeenCalledWith(
        ORG_ID,
        FeatureKey.EMPLOYEES,
        expect.any(Date),
        7,
      );
    });
  });

  describe("quantitative limits — unlimited", () => {
    it("should allow when limit is -1 (unlimited)", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.BRANCHES),
      );
      const guard = makeGuard(reflector, mockPrisma({ branches: 999 }), { maxBranches: -1 });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("FeatureKey employees (isActive fix)", () => {
    it("counts only active employees in EMPLOYEES recompute (self-heal path)", async () => {
      const prisma = mockPrisma({});
      prisma.employee.count = jest.fn().mockResolvedValue(1);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = makeGuard(reflector, prisma, { maxEmployees: 5 });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
      expect(result).toBe(true);
    });
  });

  describe("FeatureKey branches", () => {
    it("should count only active branches (self-heal path)", async () => {
      const prisma = mockPrisma({});
      prisma.branch.count = jest.fn().mockResolvedValue(3);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.BRANCHES),
      );
      const guard = makeGuard(reflector, prisma, { maxBranches: 5 });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(prisma.branch.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
      expect(result).toBe(true);
    });

    it("should throw when active branches exceed limit", async () => {
      const prisma = mockPrisma({});
      prisma.branch.count = jest.fn().mockResolvedValue(8);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.BRANCHES),
      );
      const guard = makeGuard(reflector, prisma, { maxBranches: 5 });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("FeatureKey services", () => {
    it("should count only active services (self-heal path)", async () => {
      const prisma = mockPrisma({});
      prisma.service.count = jest.fn().mockResolvedValue(7);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.SERVICES),
      );
      const guard = makeGuard(reflector, prisma, { maxServices: 10 });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(prisma.service.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
      expect(result).toBe(true);
    });
  });

  describe("FeatureKey monthly_bookings", () => {
    it("should count only non-cancelled bookings in current month (self-heal path)", async () => {
      const prisma = mockPrisma({});
      prisma.booking.count = jest.fn().mockResolvedValue(42);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.MONTHLY_BOOKINGS),
      );
      const guard = makeGuard(reflector, prisma, { maxBookingsPerMonth: 100 });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(prisma.booking.count).toHaveBeenCalledWith({
        where: {
          organizationId: ORG_ID,
          scheduledAt: { gte: expect.any(Date) },
          status: { not: "CANCELLED" },
        },
      });
      expect(result).toBe(true);
    });

    it("should throw when monthly bookings reach limit", async () => {
      const prisma = mockPrisma({});
      prisma.booking.count = jest.fn().mockResolvedValue(50);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.MONTHLY_BOOKINGS),
      );
      const guard = makeGuard(reflector, prisma, { maxBookingsPerMonth: 50 });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Feature limit reached for 'monthly_bookings': 50/50",
      );
    });
  });

  describe("FeatureKey recurring_bookings", () => {
    it("should allow when recurring_bookings is enabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.RECURRING_BOOKINGS),
      );
      const guard = makeGuard(reflector, mockPrisma({}), { recurring_bookings: true });
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it("should throw when recurring_bookings is disabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.RECURRING_BOOKINGS),
      );
      const guard = makeGuard(reflector, mockPrisma({}), { recurring_bookings: false });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("caching behavior", () => {
    it("should cache features for the same organization", async () => {
      const cacheService = mockCacheService({ maxEmployees: 10 });
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const prisma = mockPrisma({ employees: 1 });
      const counters = mockCounters(1); // counter hit → no DB call
      const guard = new FeatureGuard(
        reflector,
        prisma,
        cacheService,
        counters,
      );

      const ctx = mockContext();
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      // FeatureGuard has its own internal 60s cache (Map) keyed by organizationId.
      // Second call hits internal cache → cacheService.get NOT called again.
      expect(cacheService.get).toHaveBeenCalledTimes(1);
      // Counter hit → no DB count
      expect(prisma.employee.count).not.toHaveBeenCalled();
    });

    it("should re-fetch when cache expires", async () => {
      const cacheService = mockCacheService({ maxEmployees: 10 });
      cacheService.get = jest
        .fn()
        .mockResolvedValueOnce({
          planSlug: "pro",
          status: "ACTIVE",
          limits: { maxEmployees: 10 },
          expiresAt: Date.now() - 10,
        })
        .mockResolvedValueOnce({
          planSlug: "pro",
          status: "ACTIVE",
          limits: { maxEmployees: 10 },
          expiresAt: Date.now() + 60_000,
        });

      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const prisma = mockPrisma({ employees: 1 });
      const guard = new FeatureGuard(
        reflector,
        prisma,
        cacheService,
        mockCounters(1),
      );

      const ctx = mockContext();
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      expect(cacheService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("null subscription cache", () => {
    it("should allow when no subscription found (fail-open)", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.AI_CHATBOT),
      );
      const guard = makeGuard(reflector, mockPrisma({}), null);
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("suspended subscription", () => {
    function mockCacheServiceWithStatus(
      status: string,
      limits: Record<string, number | boolean> = {},
    ) {
      return {
        get: jest.fn().mockResolvedValue({
          planSlug: "pro",
          status,
          limits,
          expiresAt: Date.now() + 60_000,
        }),
      } as unknown as SubscriptionCacheService;
    }

    it("throws ForbiddenException('subscription_suspended') for SUSPENDED subscriptions", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.AI_CHATBOT),
      );
      const cacheService = mockCacheServiceWithStatus("SUSPENDED", { ai_chatbot: true });
      const guard = new FeatureGuard(reflector, mockPrisma({}), cacheService, mockCounters(null));
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow("subscription_suspended");
    });

    it("allows ACTIVE subscription with feature enabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.COUPONS),
      );
      const cacheService = mockCacheServiceWithStatus("ACTIVE", { coupons: true });
      const guard = new FeatureGuard(reflector, mockPrisma({}), cacheService, mockCounters(null));
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it("throws FeatureNotEnabledException for ACTIVE subscription without feature", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.COUPONS),
      );
      const cacheService = mockCacheServiceWithStatus("ACTIVE", { coupons: false });
      const guard = new FeatureGuard(reflector, mockPrisma({}), cacheService, mockCounters(null));
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(FeatureNotEnabledException);
    });
  });

  describe("FeatureNotEnabledException shape", () => {
    it("throws FeatureNotEnabledException with standard body when boolean feature off", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.COUPONS),
      );
      const guard = makeGuard(
        reflector,
        mockPrisma({}),
        { planSlug: "basic", limits: { coupons: false } },
      );
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
      try {
        await guard.canActivate(ctx);
      } catch (e: unknown) {
        const err = e as { getResponse: () => unknown };
        expect(err.getResponse()).toEqual({
          statusCode: 403,
          code: "FEATURE_NOT_ENABLED",
          featureKey: "coupons",
          planSlug: "basic",
          message: "Feature 'coupons' is not enabled for your plan",
        });
      }
    });
  });

  describe("Phase 1 / Bug B3 — DENY default for missing boolean keys", () => {
    it("denies BASIC plan on Phase-3 key (zoom_integration) when key absent from limits", async () => {
      // BASIC plans pre-Phase-3 had no zoom_integration key. With the new
      // DENY default, missing boolean keys throw FeatureNotEnabledException
      // instead of silently allowing.
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.ZOOM_INTEGRATION),
      );
      const guard = makeGuard(reflector, mockPrisma({}), {
        planSlug: "basic",
        // intentionally omit zoom_integration — pre-migration BASIC shape
        limits: { recurring_bookings: false, intake_forms: false },
      });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
    });

    it("allows PRO plan on a Phase-3 key it has (zoom_integration: true)", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.ZOOM_INTEGRATION),
      );
      const guard = makeGuard(reflector, mockPrisma({}), {
        planSlug: "pro",
        limits: { zoom_integration: true },
      });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it("missing key in Plan.limits defaults to DENY for boolean catalog entries", async () => {
      // Audit gap: any boolean catalog key NOT seeded into the plan must
      // fail closed — the historical bug was a silent ALLOW fall-through.
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.MULTI_BRANCH),
      );
      const guard = makeGuard(reflector, mockPrisma({}), {
        planSlug: "basic",
        limits: {},
      });
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
    });
  });

  describe("authentication preflight", () => {
    it("throws UnauthorizedException when req.user is missing", async () => {
      const reflector = mockReflector(jest.fn().mockReturnValue(FeatureKey.COUPONS));
      const guard = makeGuard(reflector, mockPrisma({}), { coupons: true });
      const ctx = mockContext(MISSING_USER);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Authentication required for feature-gated route",
      );
    });

    it("throws UnauthorizedException when req.user has no organizationId", async () => {
      const reflector = mockReflector(jest.fn().mockReturnValue(FeatureKey.COUPONS));
      const guard = makeGuard(reflector, mockPrisma({}), { coupons: true });
      const ctx = mockContext({});
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Authentication required for feature-gated route",
      );
    });
  });
});
