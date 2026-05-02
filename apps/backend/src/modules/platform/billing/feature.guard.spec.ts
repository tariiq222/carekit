import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { FeatureKey } from "@deqah/shared/constants/feature-keys";
import { FeatureGuard } from "./feature.guard";
import { FeatureNotEnabledException } from "./feature-not-enabled.exception";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { TenantContextService } from "../../../common/tenant/tenant-context.service";
import { PrismaService } from "../../../infrastructure/database/prisma.service";

const ORG_ID = "org-123";

function mockContext() {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn() }),
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

function mockTenant() {
  return {
    requireOrganizationId: jest.fn().mockReturnValue(ORG_ID),
  } as unknown as TenantContextService;
}

function mockPrisma(counts: Partial<Record<string, number>>) {
  return {
    branch: { count: jest.fn().mockResolvedValue(counts.branches ?? 0) },
    employee: { count: jest.fn().mockResolvedValue(counts.employees ?? 0) },
    service: { count: jest.fn().mockResolvedValue(counts.services ?? 0) },
    booking: { count: jest.fn().mockResolvedValue(counts.bookings ?? 0) },
  } as unknown as PrismaService;
}

describe("FeatureGuard", () => {
  describe("no @RequireFeature decorator", () => {
    it("should allow when no RequireFeature metadata", async () => {
      const reflector = mockReflector(jest.fn().mockReturnValue(undefined));
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService(null),
      );
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
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ ai_chatbot: false }),
      );
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
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ coupons: true }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("quantitative limits", () => {
    it("should allow when usage below limit", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({ employees: 5 }),
        mockTenant(),
        mockCacheService({ maxEmployees: 10 }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it("should throw ForbiddenException when usage equals limit", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.EMPLOYEES),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({ employees: 10 }),
        mockTenant(),
        mockCacheService({ maxEmployees: 10 }),
      );
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        "Feature limit reached for 'employees': 10/10",
      );
    });

    it("should allow when limit is -1 (unlimited)", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.BRANCHES),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({ branches: 999 }),
        mockTenant(),
        mockCacheService({ maxBranches: -1 }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("FeatureKey branches", () => {
    it("should count only active branches", async () => {
      const prisma = mockPrisma({});
      prisma.branch.count = jest.fn().mockResolvedValue(3);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.BRANCHES),
      );
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        mockCacheService({ maxBranches: 5 }),
      );
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
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        mockCacheService({ maxBranches: 5 }),
      );
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("FeatureKey services", () => {
    it("should count only active services", async () => {
      const prisma = mockPrisma({});
      prisma.service.count = jest.fn().mockResolvedValue(7);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.SERVICES),
      );
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        mockCacheService({ maxServices: 10 }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(prisma.service.count).toHaveBeenCalledWith({
        where: { organizationId: ORG_ID, isActive: true },
      });
      expect(result).toBe(true);
    });
  });

  describe("FeatureKey monthly_bookings", () => {
    it("should count only non-cancelled bookings in current month", async () => {
      const prisma = mockPrisma({});
      prisma.booking.count = jest.fn().mockResolvedValue(42);
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.MONTHLY_BOOKINGS),
      );
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        mockCacheService({ maxBookingsPerMonth: 100 }),
      );
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
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        mockCacheService({ maxBookingsPerMonth: 50 }),
      );
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
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ recurring_bookings: true }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it("should throw when recurring_bookings is disabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.RECURRING_BOOKINGS),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ recurring_bookings: false }),
      );
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("FeatureKey ZATCA", () => {
    it("should allow when ZATCA is enabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.ZATCA),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ zatca: true }),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it("should throw when ZATCA is disabled", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.ZATCA),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ zatca: false }),
      );
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
      const guard = new FeatureGuard(
        reflector,
        prisma,
        mockTenant(),
        cacheService,
      );

      const ctx = mockContext();
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      // FeatureGuard has its own internal 60s cache (Map) keyed by organizationId.
      // Second call hits internal cache → cacheService.get NOT called again.
      expect(cacheService.get).toHaveBeenCalledTimes(1);
      // However prisma.employee.count is called on every canActivate (usage is not cached internally)
      expect(prisma.employee.count).toHaveBeenCalledTimes(2);
    });

    it("should re-fetch when cache expires", async () => {
      const cacheService = mockCacheService({ maxEmployees: 10 });
      // First call: expired entry → guard writes to its internal cache with new TTL
      // Second call: internal cache hit → NO cacheService.get call
      cacheService.get = jest
        .fn()
        .mockResolvedValueOnce({
          planSlug: "pro",
          status: "ACTIVE",
          limits: { maxEmployees: 10 },
          expiresAt: Date.now() - 10, // expired — guard re-fetches and re-caches
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
        mockTenant(),
        cacheService,
      );

      const ctx = mockContext();
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      // First call triggers re-fetch (entry was expired). Second call hits the new cache entry.
      expect(cacheService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("null subscription cache", () => {
    it("should allow when no subscription found (fail-open)", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.AI_CHATBOT),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService(null),
      );
      const ctx = mockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe("FeatureNotEnabledException shape", () => {
    it("throws FeatureNotEnabledException with standard body when boolean feature off", async () => {
      const reflector = mockReflector(
        jest.fn().mockReturnValue(FeatureKey.COUPONS),
      );
      const guard = new FeatureGuard(
        reflector,
        mockPrisma({}),
        mockTenant(),
        mockCacheService({ planSlug: "basic", limits: { coupons: false } }),
      );
      const ctx = mockContext();
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        FeatureNotEnabledException,
      );
      try {
        await guard.canActivate(ctx);
      } catch (e: any) {
        expect(e.getResponse()).toEqual({
          statusCode: 403,
          code: "FEATURE_NOT_ENABLED",
          featureKey: "coupons",
          planSlug: "basic",
          message: "Feature 'coupons' is not enabled for your plan",
        });
      }
    });
  });
});
