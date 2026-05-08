# admin

## 0.4.2

### Patch Changes

- [`91e70c1`](https://github.com/tariiq222/deqah/commit/91e70c1afe428c2311294c7551dcd9777a110a07) - Phase 2/8 of 2026-05-08 admin audit fixes — backend correctness.
  - `admin-cancel-scheduled` writes (subscription update + audit log) now run inside `prisma.$allTenants.$transaction` for atomic rollback.
  - `admin-force-charge` writes the audit log BEFORE invoking Moyasar dunning, so the super-admin's destructive intent is recorded even when the external call fails.
  - `get-platform-metrics` excludes archived/inactive rows: organization total/newThisMonth use `status: { not: 'ARCHIVED' }`; user count filters `isActive: true`. Active org count tightened to `status: 'ACTIVE' AND suspendedAt: null`.
  - `list-plans` and `list-verticals` admin endpoints are now paginated (`?page`, `?perPage`, defaults 1/20, capped at 100). Response shape changed to `{ items, meta: { page, perPage, total, totalPages } }`. Frontend callers updated to destructure `items`.
  - `list-zoho-saas-invoices` `zohoMirrored` filter pushed from in-memory `.filter()` to the DB `where` clause via `id: { in: mirroredIds }` / `notIn`. `meta.total` now matches `items.length` when the filter is active; pagination no longer skips mirrored rows.
  - Subscription cache invalidation on plan update is already wired via `CacheInvalidatorListener` (subscribes to `PLAN_UPDATED_EVENT`). The audit finding flagged this as missing but verification showed it's implemented; no code change needed.

  Plan: `docs/superpowers/plans/2026-05-08-admin-audit-fixes.md`.

- [`cbfc315`](https://github.com/tariiq222/deqah/commit/cbfc3153032e99ac2c11d66ba8b0230cfe00b19b) - Phase 5/8 of 2026-05-08 admin audit fixes — defense-in-depth.
  - **IP allowlist CIDR validation** — new `IsCidrOrIpArray` class-validator decorator (using `ipaddr.js`) on `UpdateSecuritySettingsDto.ipAllowlist`. Frontend security page validates per-line on submit with inline errors.
  - **OwnerOnlyGuard** — new common guard restricting the most sensitive admin endpoints to a small env-driven allowlist (`OWNER_EMAILS`, comma-separated). Applied to: entire `BillingSettingsController` (Moyasar credentials) and method-level on `AdminBillingController.refund/waive/grant/changePlan/forceCharge/cancelScheduled`. Reads user email from DB to avoid trusting stale JWT claims (one extra query per low-volume owner-only call). Fail-closed when `OWNER_EMAILS` is unset.
  - **Rate limiting** — two `@nestjs/throttler` named limiters: `admin-mutation` (30/min) on most admin POST/PATCH/DELETE/PUT, `admin-mutation-slow` (5/min) on the destructive billing ops (refund/waive/grant/changePlan/forceCharge/cancelScheduled). Plugs into the existing Redis-backed `TenantAwareThrottlerGuard` global guard.
  - **Dashboard verticals cleanup** — removed 6 dead mutation routes from `dashboard/verticals.controller.ts` (POST/PATCH/PUT/DELETE) that duplicated `/admin/verticals` endpoints. Verticals are platform-level config; tenants must never mutate them. Verified zero FE callers.
  - **`INAPP` → `IN_APP` enum alignment** — replaced 4 callsites of the bad spelling so DTOs/types match Prisma's `DeliveryChannel.IN_APP` enum.
  - **FE↔BE path drift** — verified false positive: `adminRequest()` auto-prefixes `/admin/`; all 44 FE callsites across 38 files align correctly with the 16 backend `@Controller('admin/...')` routes.

  Closes audit findings P0 #6 (path drift — verified clean), P0 #7 (CIDR validation), P1 #11 (RBAC binary — now has owner-only tier), P1 #18 (dashboard mutation cleanup), notifications enum mismatch, rate-limit gap.

  Plan: `docs/superpowers/plans/2026-05-08-admin-audit-fixes.md`.

- [`79573a4`](https://github.com/tariiq222/deqah/commit/79573a48fa8498a50b8263031b242fe3ad36627f) - Phase 6/8 of 2026-05-08 admin audit fixes — Page Anatomy compliance.

  Adds 4 shared primitives under `apps/admin/components/` and wires them into the admin app per the "Page Anatomy — The Law" rule in `CLAUDE.md`:
  - **Breadcrumbs** — route-trail config (30 routes), rendered above page header on every list + detail page
  - **StatsGrid** — 4-card semantic grid (primary / success / warning / accent) with skeleton loading. Wired on organizations + users where backend `meta` exposes the stats; other pages have TODO comments pending BE meta extension
  - **ErrorBanner** — replaces ad-hoc error divs across 9 list pages. Captures errors to GlitchTip with context tags. Retry button calls `query.refetch()`
  - **OfflineBanner** — `navigator.onLine` listener mounted in `(admin)/layout.tsx`
  - **Action buttons** — organizations + plans tables converted to icon-only (`size-9 rounded-sm`) + `Tooltip`. Verticals / billing-subscriptions / impersonation-sessions tables have TODO comments for Phase 6.7 follow-up

  19 new primitive tests + 309 pre-existing all pass (328/328).

  Closes audit finding **P1 #8** (Page Anatomy violations).

  Plan: `docs/superpowers/plans/2026-05-08-admin-audit-fixes.md`.

- [`cdf65c8`](https://github.com/tariiq222/deqah/commit/cdf65c8d4f4438502e366c7804550566926bebe2) - Phase 7/8 of 2026-05-08 admin audit fixes — mutation observability, currency centralization, LTR enforcement, per-route error boundaries.
  - **`withSentryMutation` helper** (`apps/admin/lib/sentry-mutation.ts`) wraps all 21 admin mutation hooks. Each `useMutation` now reports failures to GlitchTip with a unique per-mutation `context` tag (e.g. `admin:billing:refund-invoice`, `admin:organization:suspend`). User-supplied `onError` (toast.error) still runs.
  - **`formatSar` / `formatCurrency`** (`apps/admin/lib/currency.ts`) replace 6 ad-hoc `Number(x).toLocaleString() + ' SAR'` callsites across `billing-metrics-grid`, `metrics-grid`, `plans-table`, and `organizations/[id]` page. Non-currency `toLocaleString` calls (counts, dates) are correctly skipped.
  - **LTR enforcement** — `apps/admin/app/layout.tsx` hard-codes `<html lang="en" dir="ltr">` per CLAUDE.md hard rule (admin is staff-only English-first). `DirectionProvider` always receives `dir="ltr"`.
  - **11 per-route `error.tsx` boundaries** — `(admin)/`, `organizations/`, `plans/`, `verticals/`, `billing/`, `audit-log/`, `impersonation-sessions/`, `users/`, `notifications/`, `metrics/`, `settings/`. Each renders `<ErrorBanner>` (introduced in Phase 6) with a `reset` callback.

  10 new tests (3 sentry-mutation + 7 currency). 338/338 admin tests pass.

  Closes audit findings **P1 #9** (RTL conditional), **P1 #15** (no mutation Sentry capture).

  Plan: `docs/superpowers/plans/2026-05-08-admin-audit-fixes.md`.

## 0.4.1

### Patch Changes

- [#169](https://github.com/tariiq222/deqah/pull/169) [`bcd8e6a`](https://github.com/tariiq222/deqah/commit/bcd8e6a465491de0e32984043a501fc938cfc8f3) Thanks [@tariiq222](https://github.com/tariiq222)! - Add official Deqah brand logo (دقة wordmark + blue check) and matching favicon to the super-admin shell + login card. Includes Next.js auto-discovered `app/icon.svg` + `app/apple-icon.svg`, plus dark/white logo variants under `public/logos/`.

## 0.4.0

### Minor Changes

- [`0fb6711`](https://github.com/tariiq222/deqah/commit/0fb67119b7c1cc72be098e63783cbd9d0f77e96f) - Bootstrap the Changesets-based per-app versioning pipeline + ship Zoho Invoice integration.

  **Zoho Invoice integration (backend, dashboard, admin)**
  - Backend: tenant→client + SaaS→tenant invoice generation, encrypted per-tenant
    Zoho credentials, scheduled-job runner, audit log, reconnect banner, per-tenant
    throttling, `API_PUBLIC_URL` for outbound webhook URLs, class-level `UseGuards`
    on Zoho controllers.
  - Dashboard: Zoho UI + per-client filter + per-tenant schedule view.
  - Admin: Zoho sidebar link + super-admin oversight surfaces.
  - E2E coverage: Playwright specs in `apps/dashboard/e2e/` for the full flow.
  - Tenant resolver bypass for auth-bootstrap routes (so Zoho OAuth callback
    works without an active tenant context).

  **Changesets pipeline (all 4 apps)**
  - Per-app independent semver in `apps/<app>/package.json`.
  - Author-written CHANGELOGs via `@changesets/cli`; one `.changeset/*.md` per
    meaningful change.
  - Promote workflow now: `verify-changesets.mjs` blocks if missing → `changeset
version` bumps + writes CHANGELOGs → single rebase+commit+push to develop →
    appends per-deploy row to `docs/operations/version-history.md` → sanitize +
    promote → dispatch build-images.
  - `build-images.yml` reads `apps/<app>/package.json` version as the primary
    Docker tag (`v<semver>`); skip-builds when the v<semver> tag already exists
    in GHCR (so single-app changes don't rebuild all 4).
  - Husky pre-push warns on missing changesets; CI gate hard-blocks the promote.
  - `scripts/release.sh` deprecated (FORCE_LEGACY=1 escape hatch).
  - Operator guide at `docs/operations/changeset-workflow.md`.

  This is the first changeset under the new system — covers everything between
  the previous main snapshot and develop.

All notable changes to the Deqah Super-Admin Control Plane (Next.js) are documented here.
This file is generated and maintained by [Changesets](https://github.com/changesets/changesets).

For pre-Changesets history (anything before 2026-05-07), see
[`docs/operations/version-history.md`](../../docs/operations/version-history.md).
