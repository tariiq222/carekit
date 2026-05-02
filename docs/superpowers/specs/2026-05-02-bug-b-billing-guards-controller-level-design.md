# Bug B Fix — Billing Guards at Controller Level (Issue #108)

**Date:** 2026-05-02
**Status:** Draft → ready for plan
**Related:** Issue #108, supersedes `2026-05-02-tenant-context-guard-design.md` (the prior `TenantContextGuard` approach was reverted — see "Why this supersedes the previous spec" below).
**Author:** Claude Opus + Tariq
**Security tier:** Owner-only (touches `BillingModule` + `feature.guard` + `enforce-limits.guard` + decorators).

## Problem

`PlanLimitsGuard` and `FeatureGuard` are registered as `APP_GUARD`s in `BillingModule` (`apps/backend/src/modules/platform/billing/billing.module.ts:109-110`). NestJS executes ALL `APP_GUARD`s **before** any controller-level `@UseGuards()`. The current pipeline is:

```
1. Express middleware  (TenantResolverMiddleware)  → CLS = DEFAULT_ORGANIZATION_ID (Riyadh)
2. APP_GUARDs:
     ├─ ThrottlerGuard
     ├─ PlanLimitsGuard      ← reads CLS = Riyadh ❌
     └─ FeatureGuard         ← reads CLS = Riyadh ❌
3. Controller-level guards:
     ├─ JwtGuard             ← Passport runs, req.user.organizationId = Jeddah
     │                       ← stampTenantContext() → CLS = Jeddah (too late)
     └─ CaslGuard
4. Interceptors / Handler
```

In `permissive` mode (the default for local dev / staging), the middleware falls back to `DEFAULT_ORGANIZATION_ID` because `req.user` does not exist yet — Passport runs inside `JwtGuard` which is controller-level. The billing guards execute against the stale fallback. Silent wrong-tenant data on every `@RequireFeature` and `@EnforceLimit` route.

**Live repro (confirmed):** super-admin impersonates Jeddah owner (BASIC plan, `coupons:false`). `GET /api/v1/dashboard/finance/coupons` returns 200 instead of 403 `FEATURE_NOT_ENABLED`. Debug log inside `FeatureGuard.canActivate` confirms it reads `org=00000000-0000-0000-0000-000000000001` (Riyadh, PRO, `coupons:true`) instead of the Jeddah JWT org.

## Goal

Make `FeatureGuard` and `PlanLimitsGuard` read the per-request tenant from the actual JWT, with zero APP_GUARD ordering race and zero collateral damage to public/auth routes.

## Non-goals

- Do **not** touch `TenantResolverMiddleware` — leave it as-is.
- Do **not** touch `JwtGuard.stampTenantContext()` — leave it as-is.
- Do **not** promote `JwtGuard` to `APP_GUARD` (this was the prior failed attempt — see below).
- Do **not** change `TENANT_ENFORCEMENT` semantics.
- Do **not** touch `tenant-scoping.extension.ts` or `SuperAdminContextInterceptor`.

## Why this supersedes the previous spec

The previous design (`2026-05-02-tenant-context-guard-design.md`) tried to promote `JwtGuard` to `APP_GUARD` and add a new `TenantContextGuard` `APP_GUARD` after it. The implementation worked for protected routes but broke 4 e2e suites (`identity/login`, `refresh-token`, `logout`, `mobile-auth`) because routes like `POST /auth/login` were never marked `@Public()` — they were just unguarded routes that the controller-level `JwtGuard` never touched. Promoting `JwtGuard` to `APP_GUARD` meant it now blocked those routes with 401.

A correct fix on that path requires auditing 30+ public/auth routes and adding `@Public()` to each — owner-only security work with a high regression surface. The 4 commits were reset; the branch `fix/tenant-context-guard-bug-b` is back to clean state.

This spec takes a smaller, structurally cleaner path: **demote** the billing guards from `APP_GUARD` to controller-level, paired with their existing `@RequireFeature` / `@EnforceLimit` decorators. The bug only manifests when those guards run before `JwtGuard`. Move them to run after, and the bug evaporates — without touching any auth route.

## Architecture

### Before (current — broken)

```
1. Express middleware: TenantResolverMiddleware    → CLS = Riyadh (fallback)
2. APP_GUARDs (declaration order):
     ├─ ThrottlerGuard
     ├─ PlanLimitsGuard       ← reads CLS = Riyadh ❌
     └─ FeatureGuard          ← reads CLS = Riyadh ❌
3. Controller-level guards:
     ├─ JwtGuard              ← Passport → req.user.organizationId = Jeddah
     │                        ← stampTenantContext() → CLS = Jeddah (too late)
     └─ CaslGuard
4. Interceptors / Handler
```

### After (proposed)

```
1. Express middleware: TenantResolverMiddleware    → CLS = Riyadh (fallback, retained for defense-in-depth)
2. APP_GUARDs:
     └─ ThrottlerGuard only
3. Controller-level guards (in @UseGuards order):
     ├─ JwtGuard              ← Passport → req.user.organizationId = Jeddah
     │                        ← stampTenantContext() → CLS = Jeddah ✅
     └─ CaslGuard
4. Method-level guards (added by @RequireFeature / @EnforceLimit decorator):
     ├─ FeatureGuard          ← reads req.user.organizationId = Jeddah ✅
     └─ PlanLimitsGuard       ← reads req.user.organizationId = Jeddah ✅
5. Interceptors (UsageTrackerInterceptor) / Handler
```

**Key NestJS contract:** controller-level + method-level guards execute in `@UseGuards` declaration order. `JwtGuard` is on the class, `FeatureGuard` is on the method (added by the decorator) → `JwtGuard` always runs first. The class-level `@UseGuards(JwtGuard, CaslGuard)` is unchanged on every dashboard controller.

## Components

### 1. `apps/backend/src/modules/platform/billing/feature.decorator.ts` (modify)

Bundle the `FeatureGuard` attachment into the existing decorator via `applyDecorators`:

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

All ~70 existing `@RequireFeature(FeatureKey.X)` call sites across 26 controller files stay exactly as they are — the bundled decorator is a transparent change.

### 2. `apps/backend/src/modules/platform/billing/plan-limits.decorator.ts` (modify)

Same pattern:

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

### 3. `apps/backend/src/modules/platform/billing/billing.module.ts` (modify)

Three changes:

1. Remove the two `APP_GUARD` registrations (lines 109-110).
2. Add `@Global()` so `FeatureGuard` / `PlanLimitsGuard` resolve via DI from any module's controller without each module having to import `BillingModule`.
3. Export `FeatureGuard` and `PlanLimitsGuard` so the DI container can resolve them when the decorator's `UseGuards()` reference fires.

```typescript
import { Global, Module, OnModuleInit } from "@nestjs/common";
// ... existing imports

@Global()
@Module({
  imports: [DatabaseModule, MailModule, MessagingModule],
  controllers: [BillingController],
  providers: [
    SubscriptionStateMachine,
    {
      provide: SubscriptionCacheService,
      useFactory: (prisma: PrismaService) => new SubscriptionCacheService(prisma),
      inject: [PrismaService],
    },
    UsageAggregatorService,
    { provide: SUBSCRIPTION_CACHE_TOKEN, useExisting: SubscriptionCacheService },
    ...HANDLERS,
    FeatureRegistryValidator,
    FeatureGuard,                                         // explicit provider
    PlanLimitsGuard,                                      // explicit provider
    { provide: APP_INTERCEPTOR, useClass: UsageTrackerInterceptor }, // unchanged
    UsageCounterService,
    IncrementUsageListener,
    CacheInvalidatorListener,
    GetUsageHandler,
    // REMOVED: { provide: APP_GUARD, useClass: PlanLimitsGuard },
    // REMOVED: { provide: APP_GUARD, useClass: FeatureGuard },
  ],
  exports: [
    FeatureGuard,                                         // new
    PlanLimitsGuard,                                      // new
    SubscriptionCacheService,
    UsageAggregatorService,
    SubscriptionStateMachine,
    UsageCounterService,
    GetUsageHandler,
    ...HANDLERS,
  ],
})
export class BillingModule implements OnModuleInit { /* unchanged */ }
```

### 4. `apps/backend/src/modules/platform/billing/feature.guard.ts` (modify)

Read `organizationId` from `req.user` directly instead of CLS. This eliminates the dependency on CLS write ordering inside this guard entirely — even if a future change introduces another race, the guard is immune.

Add an explicit `UnauthorizedException` for the case where the route reaches `FeatureGuard` without an authenticated user (currently impossible because every `@RequireFeature` route also has class-level `@UseGuards(JwtGuard)` → if Passport fails, JwtGuard throws first; if a future contributor adds `@RequireFeature` to a `@Public()` route, this assertion catches it instead of silently using a fallback tenant).

```typescript
async canActivate(ctx: ExecutionContext): Promise<boolean> {
  const featureKey = this.reflector.get<FeatureKey>(REQUIRE_FEATURE_KEY, ctx.getHandler());
  if (!featureKey) return true;

  const req = ctx.switchToHttp().getRequest<{ user?: { organizationId?: string } }>();
  if (!req.user?.organizationId) {
    throw new UnauthorizedException('Authentication required for feature-gated route');
  }
  const organizationId = req.user.organizationId;

  const { features, planSlug } = await this.resolveFeatures(organizationId);
  // ... rest of existing canActivate body unchanged (FEATURE_KEY_MAP lookup,
  //     boolean/numeric handling, currentUsage path), but uses the local
  //     `organizationId` instead of `this.tenant.requireOrganizationId()`.
}
```

The `TenantContextService` constructor injection can be dropped from this guard since it is no longer used. The other dependencies (`Reflector`, `PrismaService`, `SubscriptionCacheService`, `UsageCounterService`) stay.

### 5. `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts` (modify)

Same change. Read `organizationId` from `req.user`, drop `TenantContextService` injection, add the `UnauthorizedException` assertion. The rest of `canActivate` (subscription cache lookup, limit resolution, usage count) stays.

### 6. Files NOT touched

- `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` — unchanged.
- `apps/backend/src/common/guards/jwt.guard.ts` — unchanged. `stampTenantContext()` stays.
- `apps/backend/src/app.module.ts` — unchanged. APP_GUARD chain remains `ThrottlerGuard` only.
- `apps/backend/src/common/tenant/tenant-scoping.extension.ts` — unchanged.
- All controllers using `@RequireFeature` / `@EnforceLimit` (26 files across `src/api/dashboard/`, `src/api/mobile/client/`) — unchanged.

## Data flow

### Authenticated tenant request → `/dashboard/finance/coupons`

```
1. middleware       → CLS = Riyadh (fallback, unused)
2. ThrottlerGuard   → pass
3. JwtGuard         → Passport → req.user.organizationId = Jeddah
                    → stampTenantContext → CLS = Jeddah
4. CaslGuard        → ABAC pass
5. FeatureGuard     → req.user.organizationId = Jeddah → BASIC plan → coupons:false → 403 ✅
```

### Super-admin impersonation shadow JWT → same endpoint

```
1. middleware       → CLS = Riyadh (fallback)
2. ThrottlerGuard   → pass
3. JwtGuard         → shadow JWT → req.user.organizationId = Jeddah, scope='impersonation'
                    → assertImpersonationSessionIsLive() pass
                    → stampTenantContext → CLS = Jeddah
4. CaslGuard        → pass
5. FeatureGuard     → req.user.organizationId = Jeddah → 403 ✅
```

### Mobile public route with X-Org-Id → `/public/branding/jeddah-slug`

```
1. middleware       → @Public route, X-Org-Id valid → CLS = Jeddah
2. ThrottlerGuard   → pass
3. JwtGuard         → @Public() → return true (no Passport, no overwrite)
4. (no CaslGuard, no FeatureGuard on this route)
5. Handler          → CLS = Jeddah ✅
```

### Tenant bootstrap → `POST /public/tenants/register`

```
1. middleware       → isTenantBootstrapRoute → skip CLS write
2. ThrottlerGuard   → pass
3. JwtGuard         → @Public() → return true
4. Handler          → creates tenant, calls tenant.set() once org exists ✅
```

### `auth/login` (the route the prior attempt broke)

```
1. middleware       → non-public + no req.user + permissive → CLS = Riyadh (fallback)
2. ThrottlerGuard   → @Throttle pass
3. (no JwtGuard — controller-level guard, not on this method)
4. Handler          → issues JWT ✅ — no regression
```

The decisive point: this fix never promotes `JwtGuard` to `APP_GUARD`, so unguarded routes (login, refresh, logout, mobile auth) keep working exactly as today.

## Error handling

- `FeatureNotEnabledException` (existing) — raised by `FeatureGuard` for boolean-off feature.
- `ForbiddenException('PLAN_LIMIT_REACHED')` (existing) — raised by `PlanLimitsGuard` for quota.
- `UnauthorizedException` (new, defensive) — raised if `@RequireFeature` / `@EnforceLimit` is reached without `req.user`. Currently unreachable; protects future contributors from silent wrong-tenant if someone adds the decorator to a `@Public()` route.
- `TenantResolutionError` (existing, raised by middleware) — unchanged behavior.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Method-level guard ordering vs class-level | NestJS guarantees class-level guards run before method-level. `JwtGuard` is class-level → runs before `FeatureGuard`. Documented inline in the spec; covered by the new e2e. |
| `BillingModule` `@Global()` introduces name collisions | `FeatureGuard` and `PlanLimitsGuard` names are unique in the codebase (verified via `rg`). `npm run typecheck` will catch any collision. |
| Existing controller specs assert `Reflect.getMetadata(REQUIRE_FEATURE_KEY)` | Verified — every existing `*.controller.spec.ts` reads metadata, none assert guard counts. They continue to pass. |
| Future `@Public()` route accidentally gets `@RequireFeature` | `FeatureGuard` now throws `UnauthorizedException` when `req.user` is missing, instead of silently reading CLS fallback. |
| Bug B does not surface in unit tests | New e2e spec exercises the full controller-level guard chain via SuperTest and reproduces the live failure path. |
| `tenant-scoping.extension.ts` reads CLS before JwtGuard | No tenant-scoped query runs in the request lifecycle before `JwtGuard` (verified — `JwtStrategy.validate()` queries `User`, which is not in `SCOPED_MODELS`). The middleware's permissive-mode fallback covers any system-context edge case. In `strict` mode, the extension throws `UnauthorizedTenantAccessError` (the intended behavior). |
| `UsageTrackerInterceptor` (still APP_INTERCEPTOR) reads CLS | Interceptors run AFTER all guards including controller-level `JwtGuard`. By the time `UsageTrackerInterceptor.intercept()` calls `tenant.requireOrganizationId()`, CLS already holds the JWT-derived value written by `stampTenantContext()`. No change needed. |

## Testing

### Unit tests to update

- `apps/backend/src/modules/platform/billing/feature.guard.spec.ts` — switch the mock from `tenant.requireOrganizationId()` to `req.user.organizationId`. Add a test for the new `UnauthorizedException` path.
- `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts` — same change.

### Unit tests verified to keep passing without changes

- All `*.controller.spec.ts` files using `REQUIRE_FEATURE_KEY` / `ENFORCE_LIMIT_KEY` metadata — they read metadata only, do not assert on attached guards. (Verified by grep across `src/api/**/*.spec.ts`.)

### New e2e — `apps/backend/test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts`

Two cases (this test is specifically about ordering — broader coverage stays in the existing security suite):

1. **Authenticated tenant request — FeatureGuard reads JWT org, NOT default fallback.** Forge a JWT for the Jeddah owner. `GET /api/v1/dashboard/finance/coupons` → expect 403 `FEATURE_NOT_ENABLED` with `featureKey: 'coupons'` and `planSlug: 'BASIC'`. (Pre-fix: returned 200.)
2. **Impersonation shadow JWT — FeatureGuard reads impersonated org.** Create a real `ImpersonationSession` for Jeddah, sign a `scope='impersonation'` JWT, hit the same endpoint → expect 403 with `planSlug: 'BASIC'`.

Run mode: `process.env.TENANT_ENFORCEMENT = 'permissive'` to reproduce the original surfacing condition. The full Nest app boots via `Test.createTestingModule({ imports: [AppModule] })`, exercising the real guard chain.

### Regression suites

- Full backend unit suite: `npm run test`.
- Full backend e2e: `npm run test:e2e`.
- Full security e2e: `npx jest --config test/jest-e2e.json security/` (must remain green — including tenant-isolation, IDOR, $queryRaw backstop, webhook forgery, strict-mode enforcement).

### Live Docker smoke (final gate)

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d backend
# wait for ready
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

Expected: `HTTP/1.1 403 Forbidden` with `{"code":"FEATURE_NOT_ENABLED","featureKey":"coupons","planSlug":"BASIC", ...}`.

## Migration / rollback

- **No DB migration.**
- **No env-var change.**
- **Rollback:** revert the PR. Middleware untouched, JwtGuard untouched, APP_GUARD chain returns to today's state. Zero deployment coordination required.

## Acceptance criteria

- [ ] `RequireFeature` decorator wraps `SetMetadata + UseGuards(FeatureGuard)` via `applyDecorators`.
- [ ] `EnforceLimit` decorator wraps `SetMetadata + UseGuards(PlanLimitsGuard)` via `applyDecorators`.
- [ ] `BillingModule` is `@Global()`; both guards listed in `providers` and `exports`; the two `APP_GUARD` provider entries are removed.
- [ ] `FeatureGuard.canActivate()` reads `organizationId` from `req.user` and throws `UnauthorizedException` when missing.
- [ ] `PlanLimitsGuard.canActivate()` reads `organizationId` from `req.user` and throws `UnauthorizedException` when missing.
- [ ] `TenantResolverMiddleware`, `JwtGuard`, and `app.module.ts` are unchanged.
- [ ] `feature.guard.spec.ts` and `enforce-limits.guard.spec.ts` updated; both pass.
- [ ] New e2e `test/e2e/security/feature-gate-uses-jwt-org.e2e-spec.ts` covers the 2 ordering cases above and passes.
- [ ] Existing security e2e suite passes unchanged.
- [ ] Live Docker curl: impersonated Jeddah owner hitting `GET /api/v1/dashboard/finance/coupons` returns 403 `FEATURE_NOT_ENABLED`.
- [ ] Memory updated: Bug B → FIXED; closeout entry written.

## Open questions

(None — all resolved during brainstorming.)
