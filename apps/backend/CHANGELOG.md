# backend

## 2.1.3

### Patch Changes

- [`0e32005`](https://github.com/tariiq222/deqah/commit/0e32005f889c760ba4d7bc1caf145f030437db31) - Drop the production-only requirement for `CAPTCHA_PROVIDER` so `noop` is a valid value in any environment. Per-account lockout (5 attempts → 15-minute lock) remains the primary brute-force defense until Cloudflare Turnstile lands. Adds a `TurnstileCaptchaVerifier` stub + `TURNSTILE_SECRET` env slot so flipping `CAPTCHA_PROVIDER=turnstile` later is a config change, not a code change.

## 2.1.2

### Patch Changes

- [`6201701`](https://github.com/tariiq222/deqah/commit/6201701616d404a75a6a4ef829a74664ba106241) - Unblock production login + ops crons under `TENANT_ENFORCEMENT=strict` (#151). `LoginHandler.membership.findMany` and 6 ops cron tasks (booking-expiry legacy, booking-noshow, booking-autocomplete, group-session-automation, appointment-reminders, refresh-token-cleanup) now wrap their scoped queries in `cls.run` + `SUPER_ADMIN_CONTEXT_CLS_KEY` and switch to `prisma.$allTenants` — the canonical bypass for entry-points without a resolved tenant context. Also lazy-init `ZohoCredentialsService` so a missing `ZOHO_PROVIDER_ENCRYPTION_KEY` no longer blocks NestJS DI / app boot, and add a `RELAX_PROD_VALIDATION` escape hatch for `API_PUBLIC_URL` (mirrors the existing Zoho fields).

## 2.1.1

### Patch Changes

- [`c4b7714`](https://github.com/tariiq222/deqah/commit/c4b771422f67c9e29af611958b82755f78024957) - Add `RELAX_PROD_VALIDATION` env flag — temporary escape hatch that downgrades Zoho + hCaptcha env validation to optional in production, so the platform can boot before real credentials are populated. All other prod safety (JWT, Moyasar tenant key, encryption keys, placeholder rejection) remains strict. Remove once real keys land in Dokploy.

## 2.1.0

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

All notable changes to the Deqah Backend (NestJS API) are documented here.
This file is generated and maintained by [Changesets](https://github.com/changesets/changesets).

For pre-Changesets history (anything before 2026-05-07), see
[`docs/operations/version-history.md`](../../docs/operations/version-history.md).
