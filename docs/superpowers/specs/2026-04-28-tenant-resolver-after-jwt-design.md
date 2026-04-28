# Tenant Resolver — Run After JWT, Not Before

**Status:** drafted, not implemented (follow-up to 2026-04-28 P0 sweep).
**Owner:** @tariq.
**Severity:** P0 (security correctness, not yet a known incident).

## Problem

`AppModule.configure()` mounts `TenantResolverMiddleware` on every route via
`forRoutes('*')`. NestJS executes middleware **before** guards. The
middleware reads `req.user?.organizationId` (JWT claim attached by
`JwtStrategy.validate`), but `JwtGuard` is what populates `req.user`.

Net effect for any authenticated route:

1. Middleware runs first → `req.user` is `undefined`.
2. The middleware falls through to its lower-priority sources:
   - `fromSuperAdminHeader` requires `req.user.isSuperAdmin === true` →
     never matches.
   - `fromPublicHeader` requires `!req.user && isPublicRoute(...)` →
     matches the public-route case but bypasses the JWT path entirely.
   - `fromDefault` only fires under `permissive`.
3. Under `strict`, the middleware throws `TenantResolutionError` because no
   source produced an `organizationId` — the request fails before the JWT
   guard ever runs.

In practice the codebase compensates by running under `permissive` in dev
and relying on the Prisma scoping extension (now strict-mode fail-closed —
see `tenant-scoping.extension.ts`). That works, but the contract is
load-bearing on a side effect, not on the middleware doing its stated job.

## Goal

Move tenant-context population to **after** the JWT guard so the JWT claim
is the primary source of truth on authenticated routes, and the middleware's
public-route fallback is the only thing it does on its own.

## Approach

Two viable shapes:

### Option A — Split into two passes (recommended)

1. **`PublicTenantResolverMiddleware`** — keeps the public-route + super-
   admin-header logic. Only runs on the public + admin route prefixes.
2. **`AuthenticatedTenantResolverInterceptor`** — runs after `JwtGuard`,
   reads `req.user`, calls `TenantContextService.set(...)`. Mounted as
   `APP_INTERCEPTOR`.

Pros: clear separation, no condition-on-presence-of-user logic. The Prisma
extension's strict-mode throw catches any handler that runs before the
interceptor (programming error).

Cons: two pieces of code, must keep them in sync on edge cases.

### Option B — Single guard

Replace the middleware with a guard that runs after `JwtGuard` (lower
priority). One place, but couples public + authenticated paths.

## Migration plan

1. Add the new interceptor + middleware shapes alongside the existing
   middleware.
2. Update `AppModule` to remove the wildcard `forRoutes('*')` and instead:
   - mount the new public middleware on `public/*`,
   - register the interceptor as `APP_INTERCEPTOR`.
3. Update `test/e2e/security/strict-mode-enforcement` to assert the new
   ordering (failing-without-context should now happen at the handler, not
   at middleware).
4. Remove the now-dead `fromJwt` branch from the old middleware.

## Out of scope

- Webhook tenant resolution (already separate, system-context flow).
- Mobile `X-Org-Id` header (already public-route gated, keeps working).

## Why this is deferred, not done now

Touching middleware ordering changes the request-pipeline contract for
every authenticated endpoint. The 2026-04-28 P0 sweep already ships:
strict-mode fail-closed in the Prisma extension, fail-fast on
`TENANT_ENFORCEMENT != strict` in production, and the `sub`/`id` JwtUser
fix. Those collectively neutralise the live risk from the misorder. The
restructure here is a correctness cleanup; it deserves its own PR + a full
e2e sweep against `test/e2e/security/`.
