# backend

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
