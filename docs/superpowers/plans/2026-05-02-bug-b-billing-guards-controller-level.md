# Bug B Fix — Billing Guards at Controller Level — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demote `PlanLimitsGuard` and `FeatureGuard` from `APP_GUARD` to method-level guards (attached via `applyDecorators` inside the existing `@RequireFeature` / `@EnforceLimit` decorators), so they run AFTER controller-level `JwtGuard` and read the JWT-derived `organizationId` directly from `req.user`. Fixes Issue #108 silent wrong-tenant data leak in `permissive` mode.

**Architecture:** Bundle `UseGuards(FeatureGuard)` / `UseGuards(PlanLimitsGuard)` into the existing decorator definitions via `applyDecorators` — every existing call site stays unchanged. Mark `BillingModule` as `@Global()` and export the two guards so the DI container can resolve them from any controller. Both guards switch from `tenant.requireOrganizationId()` to reading `req.user.organizationId` directly (defense against future race conditions). `TenantResolverMiddleware`, `JwtGuard`, and `app.module.ts` are not touched.

**Tech Stack:** NestJS 11, Passport JWT, nestjs-cls, Jest (unit + e2e via SuperTest), TypeScript strict, Prisma 7.

**Spec:** `docs/superpowers/specs/2026-05-02-bug-b-billing-guards-controller-level-design.md`

**Security tier:** Owner-only. Touches `BillingModule`, `feature.guard.ts`, `enforce-limits.guard.ts`, two decorators. Pause-and-confirm on any unexpected deviation.

---

## Branch & verification context

- Branch: `fix/tenant-context-guard-bug-b` (already created and reset to clean state; spec already committed at `330696d6`).
- Target: `main`.
- Pre-existing untracked files NOT in scope (do not stage these):
  - `apps/admin/app/apple-icon.svg`
  - `apps/admin/app/icon.svg`
  - `apps/admin/public/`
  - `apps/admin/shell/deqah-logo.tsx`
  - `apps/backend/src/api/public/health.controller.ts`

## File map (all paths absolute under `/Users/tariq/code/carekit`)

**Modify:**
- `apps/backend/src/modules/platform/billing/feature.decorator.ts` — bundle `UseGuards(FeatureGuard)` via `applyDecorators`.
- `apps/backend/src/modules/platform/billing/plan-limits.decorator.ts` — bundle `UseGuards(PlanLimitsGuard)` via `applyDecorators`.
- `apps/backend/src/modules/platform/billing/billing.module.ts` — `@Global()`, remove the two `APP_GUARD` registrations, list both guards in `providers` and `exports`.
- `apps/backend/src/modules/platform/billing/feature.guard.ts` — read `organizationId` from `req.user`; throw `UnauthorizedException` if missing; drop `TenantContextService` injection.
- `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts` — same shape as `feature.guard.ts`.
- `apps/backend/src/modules/platform/billing/feature.guard.spec.ts` — adjust to drive guard via `req.user.organizationId`; add new `UnauthorizedException` case.
- `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts` — same change as above.

**Create:**
- `apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts` — 2 ordering cases.

**Do NOT touch:**
- `apps/backend/src/common/tenant/tenant-resolver.middleware.ts`
- `apps/backend/src/common/guards/jwt.guard.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/common/tenant/tenant-scoping.extension.ts`
- Any controller in `src/api/**` (the bundled decorator is transparent to them).

## Verification commands (referenced throughout)

Run from `apps/backend/` unless stated otherwise:

```bash
npm run typecheck
npx jest src/modules/platform/billing/feature.guard.spec
npx jest src/modules/platform/billing/enforce-limits.guard.spec
npx jest src/modules/platform/billing/        # whole billing folder
npx jest --config test/jest-e2e.json security/feature-gate-uses-jwt-org.e2e-spec
npx jest --config test/jest-e2e.json security/
```

Live Docker smoke (only after all tests pass):

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env build backend
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d backend
until docker logs deqah-backend 2>&1 | grep -q "Nest application successfully started"; do sleep 2; done
echo READY

ADMIN_JWT=$(curl -s -X POST http://localhost:5104/api/proxy/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@deqah.dev","password":"Deqah_admin_2026","hCaptchaToken":"10000000-aaaa-bbbb-cccc-000000000001"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

TENANT_JWT=$(curl -s -X POST http://localhost:5104/api/proxy/admin/impersonation \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"organizationId":"11111111-1111-4111-8111-111111111111","targetUserId":"8944c2e1-bb9f-440d-813c-37c2d0df248e","reason":"Bug B fix verification"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['shadowAccessToken'])")

curl -s -i "http://localhost:5104/api/proxy/dashboard/finance/coupons" \
  -H "Authorization: Bearer $TENANT_JWT" | head -20
```

Expected first lines: `HTTP/1.1 403 Forbidden` with body `{"code":"FEATURE_NOT_ENABLED","featureKey":"coupons","planSlug":"BASIC", ...}`.

---

## Task 1: Confirm clean working state

**Files:** none (sanity).

- [ ] **Step 1.1: Verify branch and clean tree**

```bash
cd /Users/tariq/code/carekit
git rev-parse --abbrev-ref HEAD
git status --short
```

Expected:
- `HEAD` returns `fix/tenant-context-guard-bug-b`.
- `git status --short` shows ONLY the untracked files listed in the "Branch & verification context" section above. No staged or modified tracked files.

If anything else is staged, **stop and report**.

- [ ] **Step 1.2: Verify the spec commit is present**

```bash
git log --oneline -3
```

Expected: `330696d6 docs(spec): Bug B fix — demote billing guards to controller-level` is at HEAD or within the last few commits. If absent, **stop and report**.

---

## Task 2: Update `feature.guard.spec.ts` — drive via `req.user`

We rewrite the spec mocks to feed the guard `organizationId` via `req.user`, not `tenant.requireOrganizationId()`. We also add a case asserting the new `UnauthorizedException` path.

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/feature.guard.spec.ts`

- [ ] **Step 2.1: Replace `mockContext()` to carry `req.user`**

Open `apps/backend/src/modules/platform/billing/feature.guard.spec.ts`. Replace the existing `mockContext` helper (around lines 14-20) with this version:

```typescript
function mockContext(user: { organizationId?: string } | undefined = { organizationId: ORG_ID }) {
  const request = { user };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue(request) }),
  } as unknown as ExecutionContext;
}
```

- [ ] **Step 2.2: Drop the `mockTenant()` helper (no longer used)**

Delete the `mockTenant()` function (around lines 55-59). Also remove `mockTenant()` from the `makeGuard()` call site (around line 92). The new `makeGuard()` body becomes:

```typescript
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
```

Drop the `TenantContextService` import at the top of the file.

- [ ] **Step 2.3: Update the two cache-test sites that bypass `makeGuard`**

In the `caching behavior` describe block, both `it()` blocks build `FeatureGuard` directly with `mockTenant()` as the third constructor arg. Update each `new FeatureGuard(...)` call to drop `mockTenant()`:

```typescript
const guard = new FeatureGuard(
  reflector,
  prisma,
  cacheService,
  counters,
);
```

(Both occurrences — one with `mockCounters(1)`, one inline.)

- [ ] **Step 2.4: Add the new `UnauthorizedException` case**

At the end of the outer `describe("FeatureGuard", ...)` block (just before its closing `});`), add this new describe block:

```typescript
describe("authentication preflight", () => {
  it("throws UnauthorizedException when req.user is missing", async () => {
    const reflector = mockReflector(jest.fn().mockReturnValue(FeatureKey.COUPONS));
    const guard = makeGuard(reflector, mockPrisma({}), { coupons: true });
    const ctx = mockContext(undefined);
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
```

- [ ] **Step 2.5: Run the spec — must FAIL (still red because guard hasn't been changed yet)**

```bash
cd apps/backend
npx jest src/modules/platform/billing/feature.guard.spec
```

Expected: red. The constructor arity mismatch (3 args vs 4) and/or the new `UnauthorizedException` test will fail. This proves we're red before going green. Do not "fix" by reverting — proceed to Task 3 next.

**Do NOT commit yet** — the spec is intentionally red.

---

## Task 3: Update `feature.guard.ts` — read from `req.user`

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/feature.guard.ts`

- [ ] **Step 3.1: Apply the guard changes**

Replace the entire content of `apps/backend/src/modules/platform/billing/feature.guard.ts` with this version:

```typescript
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
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { UsageCounterService } from "./usage-counter/usage-counter.service";
import { EPOCH, startOfMonthUTC } from "./usage-counter/period.util";
import { REQUIRE_FEATURE_KEY } from "./feature.decorator";
import { FEATURE_KEY_MAP } from "./feature-key-map";
import { FeatureNotEnabledException } from "./feature-not-enabled.exception";

interface CachedFeatures {
  features: Record<string, number | boolean>;
  planSlug: string;
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
    if (!sub) return { features: {}, planSlug: "" };

    const entry: CachedFeatures = {
      features: sub.limits,
      planSlug: sub.planSlug,
      expiresAt: Date.now() + this.ttlMs,
    };
    this.cache.set(organizationId, entry);
    return { features: entry.features, planSlug: entry.planSlug };
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
```

**What changed:**
- Removed `TenantContextService` constructor parameter and import.
- Read `organizationId` from `req.user.organizationId` instead of `tenant.requireOrganizationId()`.
- Throw `UnauthorizedException` with a clear message when `req.user` is missing or has no `organizationId`.
- Added `AuthenticatedRequest` interface for type safety on `getRequest()`.

- [ ] **Step 3.2: Run the spec — must PASS**

```bash
cd apps/backend
npx jest src/modules/platform/billing/feature.guard.spec
```

Expected: green. All existing cases pass + the two new `UnauthorizedException` cases pass. If any case fails, **stop and report** — do not adjust the test to make it pass; investigate the diff.

- [ ] **Step 3.3: Commit**

```bash
git add apps/backend/src/modules/platform/billing/feature.guard.ts \
        apps/backend/src/modules/platform/billing/feature.guard.spec.ts
git commit -m "$(cat <<'EOF'
feat(billing): FeatureGuard reads organizationId from req.user

Bug B step 1/4 — switch FeatureGuard to read the per-request tenant
directly from req.user.organizationId (set by Passport via JwtGuard)
instead of TenantContextService CLS. Adds an UnauthorizedException
on missing req.user as a defensive guard against future contributors
attaching @RequireFeature to a @Public() route.

The decorator + module wiring still ship the guard as APP_GUARD —
that's the next commit. After this commit alone the guard reads
correct data for every request that has a JWT but is still in the
APP_GUARD chain (so still triggered before JwtGuard for
@RequireFeature routes — the bug is not yet fixed end-to-end).

Issue #108

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `enforce-limits.guard.spec.ts` — drive via `req.user`

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts`

- [ ] **Step 4.1: Replace the spec content**

Replace the entire content of `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts` with this version:

```typescript
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlanLimitsGuard } from './enforce-limits.guard';

describe('PlanLimitsGuard', () => {
  const mockReflector = { get: jest.fn() };
  const mockPrisma = { branch: { count: jest.fn() }, employee: { count: jest.fn() } };
  const mockCache = { get: jest.fn() };
  const guard = new PlanLimitsGuard(
    mockReflector as never,
    mockPrisma as never,
    mockCache as never,
  );

  const buildCtx = (user: { organizationId?: string } | undefined = { organizationId: 'org-1' }) =>
    ({
      getHandler: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no @EnforceLimit decorator (kind = undefined)', async () => {
    mockReflector.get.mockReturnValue(undefined);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when req.user is missing', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    await expect(guard.canActivate(buildCtx(undefined))).rejects.toThrow(UnauthorizedException);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when req.user has no organizationId', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    await expect(guard.canActivate(buildCtx({}))).rejects.toThrow(UnauthorizedException);
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('allows when no subscription cached (returns true)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue(null);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
  });

  it('throws ForbiddenException when subscription is CANCELED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'CANCELED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Subscription is CANCELED');
  });

  it('throws ForbiddenException when subscription is SUSPENDED', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'SUSPENDED', limits: { maxBranches: 5 } });
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Subscription is SUSPENDED');
  });

  it('allows when limit is -1 (unlimited)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: -1 } });
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });

  it('allows when current < limit (count = 2, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(2);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
  });

  it('throws ForbiddenException when current >= limit (count = 3, maxBranches = 3)', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(3);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(buildCtx())).rejects.toThrow('Plan limit reached for BRANCHES: 3/3');
  });

  it('returns structured metadata when a plan limit is reached', async () => {
    mockReflector.get.mockReturnValue('BRANCHES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxBranches: 3 } });
    mockPrisma.branch.count.mockResolvedValue(3);

    try {
      await guard.canActivate(buildCtx());
      throw new Error('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'PLAN_LIMIT_REACHED',
        limitKind: 'BRANCHES',
        current: 3,
        limit: 3,
        message: 'Plan limit reached for BRANCHES: 3/3',
      });
    }
  });

  it('EMPLOYEES counts only active employees', async () => {
    mockReflector.get.mockReturnValue('EMPLOYEES');
    mockCache.get.mockResolvedValue({ status: 'ACTIVE', limits: { maxEmployees: 10 } });
    mockPrisma.employee.count.mockResolvedValue(5);
    await expect(guard.canActivate(buildCtx())).resolves.toBe(true);
    expect(mockPrisma.employee.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true },
    });
    expect(mockPrisma.branch.count).not.toHaveBeenCalled();
  });
});
```

**What changed:** dropped `mockTenant`, switched to `buildCtx(user)` carrying `req.user`, added two `UnauthorizedException` cases.

- [ ] **Step 4.2: Run the spec — must FAIL (constructor arity mismatch + missing impl)**

```bash
cd apps/backend
npx jest src/modules/platform/billing/enforce-limits.guard.spec
```

Expected: red. Constructor takes 4 args today (`reflector, prisma, tenant, cache`), spec calls with 3 (`reflector, prisma, cache`). Proves red. Proceed to Task 5.

---

## Task 5: Update `enforce-limits.guard.ts` — read from `req.user`

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts`

- [ ] **Step 5.1: Apply the guard changes**

Replace the entire content of `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts` with this version:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SubscriptionCacheService } from './subscription-cache.service';
import { ENFORCE_LIMIT_KEY, LimitKind } from './plan-limits.decorator';

interface AuthenticatedRequest {
  user?: { organizationId?: string };
}

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.get<LimitKind>(ENFORCE_LIMIT_KEY, ctx.getHandler());
    if (!kind) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException(
        'Authentication required for plan-limited route',
      );
    }

    const cached = await this.cache.get(organizationId);

    // No subscription → allow (dev/trial before billing goes live)
    if (!cached) return true;

    if (cached.status === 'CANCELED' || cached.status === 'SUSPENDED') {
      throw new ForbiddenException(`Subscription is ${cached.status}`);
    }

    const limit = this.resolveLimit(kind, cached.limits);
    if (limit === -1) return true; // unlimited

    const current = await this.currentUsage(kind, organizationId);
    if (current >= limit) {
      const message = `Plan limit reached for ${kind}: ${current}/${limit}`;
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        limitKind: kind,
        current,
        limit,
        message,
      });
    }
    return true;
  }

  private resolveLimit(kind: LimitKind, limits: Record<string, number | boolean>): number {
    switch (kind) {
      case 'BRANCHES': return Number(limits['maxBranches'] ?? 0);
      case 'EMPLOYEES': return Number(limits['maxEmployees'] ?? 0);
    }
  }

  private async currentUsage(kind: LimitKind, organizationId: string): Promise<number> {
    switch (kind) {
      case 'BRANCHES':
        return this.prisma.branch.count({ where: { organizationId, isActive: true } });
      case 'EMPLOYEES':
        return this.prisma.employee.count({ where: { organizationId, isActive: true } });
    }
  }
}
```

**What changed:**
- Removed `TenantContextService` constructor parameter and import.
- Read `organizationId` from `req.user.organizationId`.
- Throw `UnauthorizedException` with clear message when missing.

- [ ] **Step 5.2: Run the spec — must PASS**

```bash
cd apps/backend
npx jest src/modules/platform/billing/enforce-limits.guard.spec
```

Expected: green. If any case fails, **stop and report**.

- [ ] **Step 5.3: Commit**

```bash
git add apps/backend/src/modules/platform/billing/enforce-limits.guard.ts \
        apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts
git commit -m "$(cat <<'EOF'
feat(billing): PlanLimitsGuard reads organizationId from req.user

Bug B step 2/4 — same change shape as FeatureGuard: read
organizationId directly from req.user, drop TenantContextService
injection, throw UnauthorizedException on missing user.

Issue #108

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Bundle the guards into their decorators

Now we change the decorators so consumers automatically attach the guard. The 70+ existing call sites stay unchanged.

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/feature.decorator.ts`
- Modify: `apps/backend/src/modules/platform/billing/plan-limits.decorator.ts`

- [ ] **Step 6.1: Replace `feature.decorator.ts`**

Replace the entire content of `apps/backend/src/modules/platform/billing/feature.decorator.ts` with:

```typescript
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';
import { FeatureGuard } from './feature.guard';

export const REQUIRE_FEATURE_KEY = 'billing:require-feature';

export const RequireFeature = (key: FeatureKey) =>
  applyDecorators(
    SetMetadata(REQUIRE_FEATURE_KEY, key),
    UseGuards(FeatureGuard),
  );
```

- [ ] **Step 6.2: Replace `plan-limits.decorator.ts`**

Replace the entire content of `apps/backend/src/modules/platform/billing/plan-limits.decorator.ts` with:

```typescript
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PlanLimitsGuard } from './enforce-limits.guard';

export type LimitKind = 'BRANCHES' | 'EMPLOYEES';
export const ENFORCE_LIMIT_KEY = 'plan-limits:enforce';

export const EnforceLimit = (kind: LimitKind) =>
  applyDecorators(
    SetMetadata(ENFORCE_LIMIT_KEY, kind),
    UseGuards(PlanLimitsGuard),
  );
```

- [ ] **Step 6.3: Run typecheck**

```bash
cd apps/backend
npm run typecheck
```

Expected: 0 errors. The bundled decorator imports the guards from sibling files; both already exist. If typecheck flags anything else (controller imports drift, etc.), **stop and report**.

- [ ] **Step 6.4: Commit**

```bash
git add apps/backend/src/modules/platform/billing/feature.decorator.ts \
        apps/backend/src/modules/platform/billing/plan-limits.decorator.ts
git commit -m "$(cat <<'EOF'
feat(billing): bundle guards into @RequireFeature/@EnforceLimit

Bug B step 3/4 — wrap each decorator in applyDecorators so the
guard attaches at the same level as the decorator (method or
class). 70+ existing call sites stay unchanged.

This is structurally inert until step 4 removes the APP_GUARD
registration.

Issue #108

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Demote APP_GUARD registrations and globalize BillingModule

The decisive change: the guards are no longer global. Every consumer reaches them via the bundled decorator → method-level `UseGuards`. Class-level `JwtGuard` runs first (it's already on every dashboard controller as `@UseGuards(JwtGuard, CaslGuard)`), so by the time `FeatureGuard.canActivate()` runs, `req.user.organizationId` is populated.

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] **Step 7.1: Replace `billing.module.ts`**

Replace the entire content of `apps/backend/src/modules/platform/billing/billing.module.ts` with:

```typescript
import { Global, Module, OnModuleInit } from "@nestjs/common";
import { FeatureRegistryValidator } from "./feature-registry.validator";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { DatabaseModule } from "../../../infrastructure/database/database.module";
import { MailModule } from "../../../infrastructure/mail";
import { MessagingModule } from "../../../infrastructure/messaging.module";
import { UsageCounterService } from "./usage-counter/usage-counter.service";
import { IncrementUsageListener } from "./usage-counter/increment-usage.listener";
import { CacheInvalidatorListener } from "./cache-invalidator.listener";
import { GetUsageHandler } from "./get-usage/get-usage.handler";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import { SUBSCRIPTION_CACHE_TOKEN } from "../../../common/tenant/tenant-context.service";
import { BillingController } from "../../../api/dashboard/billing.controller";
import { SubscriptionStateMachine } from "./subscription-state-machine";
import { SubscriptionCacheService } from "./subscription-cache.service";
import { UsageAggregatorService } from "./usage-aggregator.service";
import { ListPlansHandler } from "./list-plans/list-plans.handler";
import { GetCurrentSubscriptionHandler } from "./get-current-subscription/get-current-subscription.handler";
import { GetMyFeaturesHandler } from "./get-my-features/get-my-features.handler";
import { StartSubscriptionHandler } from "./start-subscription/start-subscription.handler";
import { UpgradePlanHandler } from "./upgrade-plan/upgrade-plan.handler";
import { DowngradePlanHandler } from "./downgrade-plan/downgrade-plan.handler";
import { ComputeProrationHandler } from "./compute-proration/compute-proration.handler";
import { ScheduleDowngradeHandler } from "./schedule-downgrade/schedule-downgrade.handler";
import { CancelScheduledDowngradeHandler } from "./cancel-scheduled-downgrade/cancel-scheduled-downgrade.handler";
import { CancelSubscriptionHandler } from "./cancel-subscription/cancel-subscription.handler";
import { ProcessScheduledCancellationsCron } from "./process-scheduled-cancellations/process-scheduled-cancellations.cron";
import { SendLimitWarningCron } from "./send-limit-warning/send-limit-warning.cron";
import { ProcessScheduledPlanChangesCron } from "./process-scheduled-plan-changes/process-scheduled-plan-changes.cron";
import { DunningRetryCron } from "./dunning-retry/dunning-retry.cron";
import { DunningRetryService } from "./dunning-retry/dunning-retry.service";
import { RetryFailedPaymentHandler } from "./retry-failed-payment/retry-failed-payment.handler";
import { ReactivateSubscriptionHandler } from "./reactivate-subscription/reactivate-subscription.handler";
import { ResumeSubscriptionHandler } from "./resume-subscription/resume-subscription.handler";
import { RecordSubscriptionPaymentHandler } from "./record-subscription-payment/record-subscription-payment.handler";
import { IssueInvoiceHandler } from "./issue-invoice/issue-invoice.handler";
import { InvoiceNumberingService } from "./issue-invoice/invoice-numbering.service";
import { GenerateInvoicePdfHandler } from "./generate-invoice-pdf/generate-invoice-pdf.handler";
import { DownloadInvoiceHandler } from "./generate-invoice-pdf/download-invoice.handler";
import { PdfRendererService } from "./generate-invoice-pdf/pdf-renderer.service";
import { ListInvoicesHandler } from "./list-invoices/list-invoices.handler";
import { GetInvoiceHandler } from "./get-invoice/get-invoice.handler";
import { RecordSubscriptionPaymentFailureHandler } from "./record-subscription-payment-failure/record-subscription-payment-failure.handler";
import { AddSavedCardHandler } from "./saved-cards/add-saved-card.handler";
import { ListSavedCardsHandler } from "./saved-cards/list-saved-cards.handler";
import { RemoveSavedCardHandler } from "./saved-cards/remove-saved-card.handler";
import { SetDefaultSavedCardHandler } from "./saved-cards/set-default-saved-card.handler";
import { MoyasarSubscriptionClient } from "../../finance/moyasar-api/moyasar-subscription.client";
import { PlanLimitsGuard } from "./enforce-limits.guard";
import { FeatureGuard } from "./feature.guard";
import { UsageTrackerInterceptor } from "./usage-tracker.interceptor";

const HANDLERS = [
  ListPlansHandler,
  GetCurrentSubscriptionHandler,
  GetMyFeaturesHandler,
  StartSubscriptionHandler,
  ComputeProrationHandler,
  UpgradePlanHandler,
  DowngradePlanHandler,
  ScheduleDowngradeHandler,
  CancelScheduledDowngradeHandler,
  CancelSubscriptionHandler,
  ProcessScheduledCancellationsCron,
  SendLimitWarningCron,
  ProcessScheduledPlanChangesCron,
  DunningRetryService,
  DunningRetryCron,
  RetryFailedPaymentHandler,
  ReactivateSubscriptionHandler,
  ResumeSubscriptionHandler,
  ListSavedCardsHandler,
  AddSavedCardHandler,
  SetDefaultSavedCardHandler,
  RemoveSavedCardHandler,
  RecordSubscriptionPaymentHandler,
  RecordSubscriptionPaymentFailureHandler,
  MoyasarSubscriptionClient,
  IssueInvoiceHandler,
  InvoiceNumberingService,
  GenerateInvoicePdfHandler,
  DownloadInvoiceHandler,
  PdfRendererService,
  ListInvoicesHandler,
  GetInvoiceHandler,
];

@Global()
@Module({
  imports: [DatabaseModule, MailModule, MessagingModule],
  controllers: [BillingController],
  providers: [
    SubscriptionStateMachine,
    // Factory avoids DI trying to inject the optional 'options' parameter
    // (index [1] in the constructor) — it's for unit-test injection only.
    {
      provide: SubscriptionCacheService,
      useFactory: (prisma: PrismaService) =>
        new SubscriptionCacheService(prisma),
      inject: [PrismaService],
    },
    UsageAggregatorService,
    // Expose SubscriptionCacheService under the token TenantContextService expects
    {
      provide: SUBSCRIPTION_CACHE_TOKEN,
      useExisting: SubscriptionCacheService,
    },
    ...HANDLERS,
    FeatureRegistryValidator,
    // FeatureGuard + PlanLimitsGuard are NO LONGER APP_GUARDs. They are
    // attached at the method level via the @RequireFeature / @EnforceLimit
    // decorators (see feature.decorator.ts / plan-limits.decorator.ts).
    // Listed as plain providers + exported below so any importing module's
    // controller can resolve them via DI.
    FeatureGuard,
    PlanLimitsGuard,
    { provide: APP_INTERCEPTOR, useClass: UsageTrackerInterceptor },
    UsageCounterService,
    IncrementUsageListener,
    CacheInvalidatorListener,
    GetUsageHandler,
  ],
  exports: [
    FeatureGuard,
    PlanLimitsGuard,
    SubscriptionCacheService,
    UsageAggregatorService,
    SubscriptionStateMachine,
    UsageCounterService,
    GetUsageHandler,
    ...HANDLERS,
  ],
})
export class BillingModule implements OnModuleInit {
  constructor(private readonly featureRegistry: FeatureRegistryValidator) {}

  onModuleInit(): void {
    // Fail fast on registry drift — see feature-registry.validator.ts.
    this.featureRegistry.validate();
  }
}
```

**What changed vs. current:**
- Added `Global` to the import from `@nestjs/common`.
- Added `@Global()` decorator above `@Module(...)`.
- Removed `APP_GUARD` from the `@nestjs/core` import (still imports `APP_INTERCEPTOR`).
- Removed the two lines `{ provide: APP_GUARD, useClass: PlanLimitsGuard }` and `{ provide: APP_GUARD, useClass: FeatureGuard }`.
- Listed `FeatureGuard` and `PlanLimitsGuard` as plain providers.
- Added both guards to `exports`.

- [ ] **Step 7.2: Run typecheck + the billing folder unit tests**

```bash
cd apps/backend
npm run typecheck
npx jest src/modules/platform/billing/
```

Expected: typecheck 0 errors. All billing unit specs (feature.guard, enforce-limits.guard, subscription-cache, cache-invalidator.listener, etc.) green. If anything breaks, **stop and report**.

- [ ] **Step 7.3: Commit**

```bash
git add apps/backend/src/modules/platform/billing/billing.module.ts
git commit -m "$(cat <<'EOF'
feat(billing): demote FeatureGuard/PlanLimitsGuard from APP_GUARD

Bug B step 4/4 — the fix lands here.

- Mark BillingModule as @Global() so any controller's module can
  resolve FeatureGuard/PlanLimitsGuard via DI when the bundled
  decorator's UseGuards() reference fires.
- Drop the two APP_GUARD provider entries; the guards are now
  attached at method level by @RequireFeature/@EnforceLimit.
- Export both guards.

Effect on the request lifecycle for @RequireFeature routes:

  Before: middleware (CLS=Riyadh) → APP_GUARDs (FeatureGuard reads
  Riyadh ❌) → JwtGuard (req.user=Jeddah, stamp CLS too late) → Handler.

  After:  middleware (CLS=Riyadh, unused) → APP_GUARDs (Throttler
  only) → class-level JwtGuard (req.user=Jeddah, stamp CLS) →
  CaslGuard → method-level FeatureGuard (reads req.user=Jeddah ✅)
  → Handler.

Closes Issue #108. Middleware, JwtGuard, and app.module.ts are
unchanged. No DB migration. Rollback = revert this PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Run the full backend unit suite

A quick regression sweep before going to e2e — catches any test that asserted on the old guard wiring.

**Files:** none (test run only).

- [ ] **Step 8.1: Run the full unit suite**

```bash
cd apps/backend
npm run test 2>&1 | tail -40
```

Expected: full green (matching the pre-fix baseline). If any previously-green test is now red, **stop and report** with the file name + failure message. Do not silently fix.

---

## Task 9: Add the e2e ordering test

This is the test that proves Bug B is fixed end-to-end against the same path the live QA hit.

**Files:**
- Create: `apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts`

- [ ] **Step 9.1: Write the e2e spec**

Create `apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts` with this content:

```typescript
/**
 * E2E: feature-gate uses the JWT-derived organizationId, not the
 * permissive-mode CLS fallback (Issue #108 — Bug B).
 *
 * Two cases that exercise the FULL guard chain via SuperTest:
 *
 *   1. Authenticated tenant request — FeatureGuard MUST read the JWT org.
 *      Pre-fix this returned 200 because FeatureGuard ran as APP_GUARD
 *      before JwtGuard, reading the middleware's permissive-mode fallback
 *      (Riyadh on PRO with coupons:true). Post-fix it returns 403.
 *
 *   2. Impersonation shadow JWT — same shape, different code path
 *      through JwtGuard.assertImpersonationSessionIsLive().
 *
 * Run mode: TENANT_ENFORCEMENT=permissive (the mode the bug surfaces in).
 * The harness's default is strict — we override here.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

const JEDDAH_ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('Feature gate uses JWT org (Bug B / Issue #108)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeAll(async () => {
    process.env.TENANT_ENFORCEMENT = 'permissive';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);

    // Sanity: Jeddah org must exist on BASIC plan with coupons:false.
    // The global-setup seeds these fixtures.
    const jeddah = await prisma.$allTenants.organization.findUnique({
      where: { id: JEDDAH_ORG_ID },
      include: { subscription: { include: { plan: true } } },
    });
    if (!jeddah || jeddah.subscription?.plan?.slug !== 'BASIC') {
      throw new Error(
        'Test fixture missing: Jeddah org must exist and be on BASIC plan. ' +
          'Run the standard e2e seed first.',
      );
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  /**
   * Forge a tenant-user JWT for the Jeddah owner. We don't go through
   * the impersonation handler — we're testing the GUARD ORDERING, not
   * the impersonation workflow.
   */
  const forgeJeddahOwnerJwt = async () => {
    const ownerMembership = await prisma.$allTenants.membership.findFirst({
      where: { organizationId: JEDDAH_ORG_ID, role: 'OWNER' },
      include: { user: true },
    });
    if (!ownerMembership) {
      throw new Error('Jeddah owner membership missing in seed');
    }
    return {
      ownerMembership,
      token: jwt.sign(
        {
          sub: ownerMembership.user.id,
          email: ownerMembership.user.email,
          role: 'ADMIN',
          membershipRole: 'OWNER',
          organizationId: JEDDAH_ORG_ID,
          membershipId: ownerMembership.id,
          isSuperAdmin: false,
          permissions: [],
          features: [],
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      ),
    };
  };

  it('Case 1: tenant JWT → FeatureGuard reads JWT org, returns 403 on coupons', async () => {
    const { token } = await forgeJeddahOwnerJwt();

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/finance/coupons')
      .set('Authorization', `Bearer ${token}`);

    // Pre-fix: 200 (guard read DEFAULT_ORG = Riyadh, PRO, coupons:true).
    // Post-fix: 403 (guard reads req.user.organizationId = Jeddah, BASIC).
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      code: 'FEATURE_NOT_ENABLED',
      featureKey: 'coupons',
      planSlug: 'BASIC',
    });
  });

  it('Case 2: impersonation shadow JWT → FeatureGuard reads impersonated org', async () => {
    const ownerMembership = await prisma.$allTenants.membership.findFirst({
      where: { organizationId: JEDDAH_ORG_ID, role: 'OWNER' },
      include: { user: true },
    });
    const superAdmin = await prisma.$allTenants.user.findFirst({
      where: { isSuperAdmin: true, isActive: true },
    });
    if (!ownerMembership || !superAdmin) {
      throw new Error('Required seed fixtures missing');
    }

    const session = await prisma.$allTenants.impersonationSession.create({
      data: {
        superAdminUserId: superAdmin.id,
        targetUserId: ownerMembership.user.id,
        organizationId: JEDDAH_ORG_ID,
        reason: 'e2e Bug B regression test',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    try {
      const shadow = jwt.sign(
        {
          sub: ownerMembership.user.id,
          email: ownerMembership.user.email,
          role: 'ADMIN',
          membershipRole: 'OWNER',
          organizationId: JEDDAH_ORG_ID,
          membershipId: ownerMembership.id,
          isSuperAdmin: false,
          scope: 'impersonation',
          impersonatedBy: superAdmin.id,
          impersonationSessionId: session.id,
          permissions: [],
          features: [],
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' },
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/finance/coupons')
        .set('Authorization', `Bearer ${shadow}`);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        code: 'FEATURE_NOT_ENABLED',
        featureKey: 'coupons',
        planSlug: 'BASIC',
      });
    } finally {
      await prisma.$allTenants.impersonationSession.delete({
        where: { id: session.id },
      });
    }
  });
});
```

- [ ] **Step 9.2: Run the new e2e**

```bash
cd apps/backend
npx jest --config test/jest-e2e.json security/feature-gate-uses-jwt-org.e2e-spec
```

Expected: both cases pass. If Case 1 returns 200, the demotion did not take effect at runtime — **stop and report**, capture the response body and the registered guards (look at backend logs for `FeatureGuard` mounting).

If the seed lacks the Jeddah org or BASIC plan, the `beforeAll` throws — that means the test database is missing fixtures. **Stop and report**; do not edit the test to skip the assertion.

- [ ] **Step 9.3: Run the FULL e2e security suite (regression check)**

```bash
cd apps/backend
npx jest --config test/jest-e2e.json security/
```

Expected: every spec under `test/e2e/security/` is green — including `cross-tenant-penetration`, `membership-profile-isolation`, `mobile-public-tenant-header`, `moyasar-webhook-forgery`, `rls-backstop`, `rls-with-check`, `strict-mode-enforcement`, `usage-counter-isolation`, plus the new spec. If any pre-existing spec turns red, **stop and report** the spec name + first failure.

- [ ] **Step 9.4: Run the FULL e2e suite (broader regression)**

```bash
cd apps/backend
npm run test:e2e 2>&1 | tail -40
```

Expected: full green. If a spec outside `security/` regresses, **stop and report**. The suite is intentionally broad so this catches anything we missed (mobile, dashboard, etc.).

- [ ] **Step 9.5: Commit**

```bash
git add apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): regression for feature-gate JWT-org ordering (Issue #108)

Two cases reproducing the live Bug B path through SuperTest:

1. Authenticated Jeddah owner hits GET /dashboard/finance/coupons →
   expects 403 FEATURE_NOT_ENABLED (was 200 pre-fix because
   FeatureGuard ran as APP_GUARD against the permissive-mode CLS
   fallback = Riyadh on PRO).
2. Impersonation shadow JWT for Jeddah → same endpoint → 403.

Runs under TENANT_ENFORCEMENT=permissive — the mode the bug
surfaces in. The harness default of strict would mask this exact
regression.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Live Docker smoke

Final gate. The same command that surfaced Bug B against PR #104 must now return 403.

**Files:** none.

- [ ] **Step 10.1: Rebuild + restart backend in Docker**

```bash
cd /Users/tariq/code/carekit
docker compose -f docker/docker-compose.yml --env-file docker/.env build backend
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d backend
until docker logs deqah-backend 2>&1 | grep -q "Nest application successfully started"; do sleep 2; done
echo READY
```

Expected: `READY` printed within ~60s. If startup fails, run `docker logs deqah-backend | tail -50` and **stop**.

- [ ] **Step 10.2: Reproduce the original Bug B repro**

```bash
ADMIN_JWT=$(curl -s -X POST http://localhost:5104/api/proxy/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@deqah.dev","password":"Deqah_admin_2026","hCaptchaToken":"10000000-aaaa-bbbb-cccc-000000000001"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])")

TENANT_JWT=$(curl -s -X POST http://localhost:5104/api/proxy/admin/impersonation \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"organizationId":"11111111-1111-4111-8111-111111111111","targetUserId":"8944c2e1-bb9f-440d-813c-37c2d0df248e","reason":"Bug B fix verification"}' \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['shadowAccessToken'])")

curl -s -i "http://localhost:5104/api/proxy/dashboard/finance/coupons" \
  -H "Authorization: Bearer $TENANT_JWT" | head -20
```

Expected first lines:

```
HTTP/1.1 403 Forbidden
...
{"statusCode":403,"code":"FEATURE_NOT_ENABLED","featureKey":"coupons","planSlug":"BASIC", ...}
```

If the response is 200, the runtime did not pick up the new code. Verify the docker build used the new sources:

```bash
docker exec deqah-backend node -e "console.log(require('fs').readFileSync('/app/dist/modules/platform/billing/billing.module.js', 'utf8').includes('@Global'))"
```

If false, the rebuild was stale — rebuild with `--no-cache` and try again. **Stop and report** if still 200 after a clean rebuild.

- [ ] **Step 10.3: Save the response body for the QA log**

```bash
mkdir -p docs/superpowers/qa
curl -s -i "http://localhost:5104/api/proxy/dashboard/finance/coupons" \
  -H "Authorization: Bearer $TENANT_JWT" > docs/superpowers/qa/bug-b-final-smoke-2026-05-02.txt
```

(Used in Task 12.)

- [ ] **Step 10.4: No commit yet — verification only.**

---

## Task 11: Push, open PR, merge

**Files:** none until step 11.4.

- [ ] **Step 11.1: Push the branch**

```bash
cd /Users/tariq/code/carekit
git push -u origin fix/tenant-context-guard-bug-b
```

- [ ] **Step 11.2: Open the PR**

```bash
gh pr create --title "fix(billing): demote feature/limit guards to controller level (Bug B / #108)" --body "$(cat <<'EOF'
## Summary

- Demote `PlanLimitsGuard` and `FeatureGuard` from `APP_GUARD` to method-level guards via the existing `@RequireFeature` / `@EnforceLimit` decorators (now bundled with `applyDecorators(SetMetadata, UseGuards)`).
- `BillingModule` is now `@Global()` and exports both guards so any importing module's controller can resolve them via DI.
- Both guards now read `organizationId` directly from `req.user` (set by Passport via the existing controller-level `JwtGuard`) instead of `TenantContextService` CLS — eliminating the read-before-write race.
- New e2e: `test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts` reproduces the live failure path under SuperTest with `TENANT_ENFORCEMENT=permissive`.

Fixes #108. Closes Bug B from `feature-overrides-live-e2e-2026-05-02.md`. See [`docs/superpowers/specs/2026-05-02-bug-b-billing-guards-controller-level-design.md`](docs/superpowers/specs/2026-05-02-bug-b-billing-guards-controller-level-design.md).

## Why not the prior `TenantContextGuard` approach?

The earlier spec promoted `JwtGuard` to `APP_GUARD` and slotted a new `TenantContextGuard` after it. That broke 4 e2e auth suites because `POST /auth/login`, `/auth/refresh`, `/auth/logout`, and mobile-auth routes are unguarded (not `@Public()`-decorated) — APP_GUARD `JwtGuard` started 401-ing them. A correct fix on that path requires auditing 30+ public/auth routes.

This PR takes the smaller path: demote the billing guards. The bug only manifests when they run before `JwtGuard`. Move them to run after, and the bug evaporates — without touching any auth route.

## Test plan

- [x] `npm run typecheck` — 0 errors.
- [x] `npx jest src/modules/platform/billing/feature.guard.spec` — green.
- [x] `npx jest src/modules/platform/billing/enforce-limits.guard.spec` — green.
- [x] `npx jest src/modules/platform/billing/` — full billing folder green.
- [x] `npm run test` — full backend unit suite green.
- [x] `npx jest --config test/jest-e2e.json security/feature-gate-uses-jwt-org.e2e-spec` — green.
- [x] `npx jest --config test/jest-e2e.json security/` — full security e2e green.
- [x] `npm run test:e2e` — full backend e2e green.
- [x] Live Docker smoke: `GET /api/v1/dashboard/finance/coupons` with impersonated Jeddah JWT returns 403 `FEATURE_NOT_ENABLED` (was 200 pre-fix).

## Rollout

Pure code change, no DB migration, no env-var change. Rollback = revert this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 11.3: Wait for CI / verify mergeable**

```bash
gh pr view --json mergeable,mergeStateStatus,statusCheckRollup
```

Expected: `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`. If still pending, wait. If a check fails, **stop and report** the check name and log link.

- [ ] **Step 11.4: Merge (squash, delete branch)**

```bash
gh pr merge --squash --delete-branch
```

Expected: `Squashed and merged ...`. Then on `main`:

```bash
git checkout main
git pull
git log --oneline -3
```

The squash commit should be at HEAD.

---

## Task 12: Closeout — memory + Kiwi

**Files:**
- Create: `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/bug_b_billing_guards_demoted_2026_05_02.md`
- Modify: `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md`
- Modify: `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/feature_overrides_live_e2e_2026_05_02.md`
- Create: `data/kiwi/bug-b-billing-guards-2026-05-02.json`

- [ ] **Step 12.1: Write the closeout memory**

Write `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/bug_b_billing_guards_demoted_2026_05_02.md` with:

```markdown
---
name: Bug B (Issue #108) — fixed by demoting billing guards to controller level
description: APP_GUARD ordering fix that demotes PlanLimitsGuard + FeatureGuard from global APP_GUARDs to method-level guards bundled into the @RequireFeature / @EnforceLimit decorators. They now run AFTER controller-level JwtGuard and read organizationId from req.user, fixing the silent wrong-tenant data leak in permissive mode. Merged 2026-05-02.
type: project
---

Bug B from `feature_overrides_live_e2e_2026_05_02.md` is closed.

**What changed:**
- `@RequireFeature` and `@EnforceLimit` decorators now bundle `UseGuards(...)` via `applyDecorators` — call sites unchanged, but the guard attaches at method level.
- `BillingModule` is `@Global()` and exports `FeatureGuard` + `PlanLimitsGuard` (so any importing module's controller can resolve them via DI).
- The two `APP_GUARD` registrations for these guards are removed.
- `FeatureGuard` and `PlanLimitsGuard` now read `organizationId` from `req.user` (set by Passport via class-level `JwtGuard`), not from `TenantContextService` CLS. They throw `UnauthorizedException` if `req.user` is missing — defensive against future contributors attaching the decorator to a `@Public()` route.
- `TenantResolverMiddleware`, `JwtGuard`, and `app.module.ts` are unchanged.
- New e2e `test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts` (2 cases) regression-tests the JWT-org path under `TENANT_ENFORCEMENT=permissive`.

**Why not the TenantContextGuard approach?** That earlier attempt promoted `JwtGuard` to `APP_GUARD` and broke 4 e2e auth suites because routes like `POST /auth/login` are unguarded but not `@Public()`-decorated. A correct fix on that path needs a 30-route audit. Demoting the billing guards is the smaller, structurally cleaner path with zero auth-route surface.

**How to apply:** When adding a new guard that needs the per-request tenant, prefer reading `req.user.organizationId` directly over `TenantContextService.requireOrganizationId()`. CLS is fine for handlers, but inside a guard the only way to be safe is to not depend on CLS write ordering at all.

**Files of record:**
- `apps/backend/src/modules/platform/billing/feature.decorator.ts`
- `apps/backend/src/modules/platform/billing/plan-limits.decorator.ts`
- `apps/backend/src/modules/platform/billing/feature.guard.ts`
- `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts`
- `apps/backend/src/modules/platform/billing/billing.module.ts`
- `apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts`

**PR:** TBD on merge — link goes here.
**Spec:** `docs/superpowers/specs/2026-05-02-bug-b-billing-guards-controller-level-design.md`
```

- [ ] **Step 12.2: Add the entry to MEMORY.md**

Open `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md` and add this line **right after** the existing "Feature Overrides — live E2E findings" entry:

```markdown
- [Bug B fixed — billing guards demoted 2026-05-02](bug_b_billing_guards_demoted_2026_05_02.md) — APP_GUARD ordering fix; @RequireFeature / @EnforceLimit guards now run at method level, after JwtGuard
```

- [ ] **Step 12.3: Update the existing live-E2E memory to mark Bug B closed**

Open `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/feature_overrides_live_e2e_2026_05_02.md`. Find the heading containing "Bug B" and "DEFERRED". Replace `DEFERRED` with `FIXED (2026-05-02)`. Then prepend a one-line closeout note immediately under that heading:

```markdown
**Status: closed.** Fixed by demoting billing guards to method level — the prior `TenantContextGuard` approach was abandoned because it required a 30-route auth-public audit. See `bug_b_billing_guards_demoted_2026_05_02.md`.
```

- [ ] **Step 12.4: Write the Kiwi run JSON**

Create `data/kiwi/bug-b-billing-guards-2026-05-02.json`:

```json
{
  "domain": "Security",
  "version": "main",
  "build": "bug-b-billing-guards-2026-05-02",
  "planName": "Bug B — Billing Guards Demotion (Issue #108)",
  "planSummary": "Issue #108: APP_GUARD ordering. Demote PlanLimitsGuard + FeatureGuard from APP_GUARD to method-level via @RequireFeature/@EnforceLimit decorators. Both guards read organizationId from req.user instead of CLS.",
  "runSummary": "2/2 e2e cases pass + live Docker curl returns 403 on Jeddah BASIC coupons (was 200 pre-fix).",
  "cases": [
    {
      "summary": "Tenant JWT — FeatureGuard reads JWT org, returns 403 on coupons",
      "text": "GET /api/v1/dashboard/finance/coupons with a Jeddah owner JWT under TENANT_ENFORCEMENT=permissive. Expect 403 FEATURE_NOT_ENABLED with planSlug:BASIC. Pre-fix: 200 (guard read DEFAULT_ORG=Riyadh from middleware CLS fallback).",
      "result": "PASS"
    },
    {
      "summary": "Impersonation shadow JWT — FeatureGuard reads impersonated org",
      "text": "Same endpoint with a scope='impersonation' shadow JWT for Jeddah. Expect 403. Pre-fix: 200.",
      "result": "PASS"
    }
  ]
}
```

- [ ] **Step 12.5: Sync to Kiwi**

```bash
cd /Users/tariq/code/carekit
npm run kiwi:sync-manual data/kiwi/bug-b-billing-guards-2026-05-02.json
```

Expected: `Plan: ... (id=NN)` and `Run: 2/2 PASS ... (id=MM)`. Capture the IDs into the memory file at the end of Step 12.1 (replace the `**PR:** TBD` line with the actual PR URL + Kiwi IDs).

- [ ] **Step 12.6: Commit the Kiwi JSON**

The data/kiwi/* path is in .gitignore, so use `-f`:

```bash
cd /Users/tariq/code/carekit
git add -f data/kiwi/bug-b-billing-guards-2026-05-02.json
git commit -m "test(kiwi): sync bug-b billing-guards 2026-05-02

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

(Memory files live outside the repo — no commit needed for those.)

---

## Self-Review

**Spec coverage** — every section of the design spec maps to a task:

- Architecture (Before/After) → Tasks 6-7 (decorator + module wiring).
- Components.1 (`feature.decorator.ts`) → Task 6.1.
- Components.2 (`plan-limits.decorator.ts`) → Task 6.2.
- Components.3 (`billing.module.ts`) → Task 7.
- Components.4 (`feature.guard.ts`) → Tasks 2-3.
- Components.5 (`enforce-limits.guard.ts`) → Tasks 4-5.
- Components.6 (Files NOT touched) → enforced by NOT including them in any task; `git status` after each task should not show drift in those files.
- Data flow (5 scenarios) → Cases 1-2 of the new e2e directly cover authenticated tenant + impersonation flows; the public-route, tenant-bootstrap, and auth/login scenarios continue to be covered by the existing security/e2e suites (Task 9.3 ensures no regression).
- Error handling → covered: existing exceptions retained, new `UnauthorizedException` covered by Tasks 2.4 + 4 cases.
- Risks (method/class ordering) → enforced by Task 9 e2e + spec inline note.
- Risks (`@Global()` collisions) → Task 6.3 + Task 7.2 typecheck.
- Risks (controller specs) → Task 8 full unit suite.
- Risks (future @Public + @RequireFeature) → defensive `UnauthorizedException` covered by Tasks 2.4 + 4 unit tests.
- Risks (Bug B regression) → Task 9 e2e is the canonical regression test.
- Risks (`tenant-scoping.extension`) → no change required; behavior unchanged because the guards no longer rely on CLS at all.
- Risks (`UsageTrackerInterceptor`) → no change required; interceptor runs after all guards, CLS is correct by then.
- Acceptance criteria — every checkbox in the spec maps to a task: bundled decorators (T6), `@Global()` + exports + APP_GUARD removal (T7), guards read `req.user` + throw on missing (T3 + T5), middleware/JwtGuard/app.module untouched (verified across all tasks), unit specs updated (T2 + T4), new e2e (T9), full security e2e (T9.3), live curl (T10), memory + Kiwi (T12).

**Placeholder scan** — no TBDs. Every step has either complete code or a complete command. The `PR: TBD` in the closeout memory is intentional — Step 12.5 instructs replacing it with the actual link.

**Type consistency** — `FeatureGuard` constructor reduces from 5 args to 4; spec mocks updated in Step 2.1-2.3 + cache tests in Step 2.3. `PlanLimitsGuard` constructor reduces from 4 args to 3; spec rewritten in Step 4.1. `AuthenticatedRequest` interface defined identically in both guard files. The new `UnauthorizedException` import added in both guard files (Tasks 3 + 5) and both spec files (Tasks 2 + 4).

**Pause-and-confirm points** — flagged at: Task 1.1 (unexpected staged files), 1.2 (missing spec commit), 3.2 (any unit failure), 5.2 (any unit failure), 6.3 (typecheck error), 7.2 (typecheck or unit failure), 8.1 (regression in unguarded test), 9.2 (Case 1 returns 200 = runtime didn't pick up the change), 9.3 (existing e2e turns red), 9.4 (broader e2e regression), 10.1 (Docker startup fails), 10.2 (live curl returns 200 after clean rebuild), 11.3 (CI failure), 12.5 (Kiwi sync error). Owner-only area gets these guardrails as the spec requested.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-bug-b-billing-guards-controller-level.md`.**
