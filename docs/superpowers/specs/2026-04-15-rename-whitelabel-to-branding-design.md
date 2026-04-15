# Rename: whitelabel / theme → branding (Unified Naming)

**Date:** 2026-04-15
**Owner:** @tariq
**Status:** Design approved — ready for implementation plan

## Goal

Unify every reference to the visual-identity feature under a single name: **branding**. Eliminate all legacy `whitelabel`, `WhiteLabel`, `white-label`, and duplicate `theme` identifiers across the monorepo so the codebase matches the backend (which already uses `branding`) and the product-facing name.

## Motivation

The backend was renamed to `branding` some time ago (Prisma model `BrandingConfig`, module `org-experience/branding/`, endpoints `/dashboard/organization/branding` + `/public/branding/:tenantId`). The frontend, shared packages, mobile app, and documentation were never updated. Current reality:

- Route slug `/white-label`, directory `white-label/`, component `BrandingTab` (misleading — not a tab)
- Hook `useWhitelabel`, API file `whitelabel.ts`, type `WhiteLabelConfig`, query key `["whitelabel", "config"]`
- `packages/api-client` exposes **two duplicate modules** (`theme.ts` and `whitelabel.ts`) that both hit a broken endpoint `/whitelabel/public` which does not exist on the backend
- i18n keys mixed: `whiteLabel.*` in the page, `settings.tabs.branding` elsewhere
- Root `CLAUDE.md` lists the model as `WhiteLabelConfig` and the module under `settings/` — both wrong
- CASL permission string is `whitelabel:edit` in frontend guards; unclear whether DB rows exist with `subject='whitelabel'`

This incoherence causes confusion for every new contributor and breaks the public branding endpoint from shared clients.

## Non-Goals

- Renaming the `BrandingConfig` Prisma model — already correct
- Renaming the backend module `org-experience/branding/` — already correct
- Changing API endpoint URLs — already correct (`/dashboard/organization/branding`, `/public/branding/:tenantId`)
- Redesigning the branding UI, splitting `branding-tab.tsx`, or adding a logo uploader — out of scope (separate task)
- Sanitizing `customCss` field for XSS — out of scope

## Approach

Single atomic rename executed on a dedicated branch (`feature/rename-branding`) with small internal commits for debuggability, then **squash-merged** to `main` as one commit. The intermediate state inside the branch can temporarily fail cross-package builds; `main` never sees a broken state.

We deliberately **skip the CareKit ≤10 files / ≤500 lines commit rule** for this rename because splitting a whole-tree rename across merges into `main` creates more churn and confusion than a single squashed commit. This exception is owner-authorized for this task only.

No transitional aliases. No deprecated re-exports. Full cut-over.

## Scope — Files to Change

### packages/shared
- `types/theme.ts` → `types/branding.ts`
  - `OrganizationTheme` → `BrandingConfig`
  - `DEFAULT_THEME` → `DEFAULT_BRANDING`
  - `DerivedTokens` keeps its name (generic enough)
- `types/index.ts` — export path
- `enums/index.ts` — any `WHITELABEL` enum member renamed
- `tokens/index.ts` — any `whitelabel` token renamed
- `constants/modules.ts` — module constant renamed

### packages/api-client
- **Delete** `modules/theme.ts` (duplicate)
- **Delete** `modules/whitelabel.ts`
- **Create** `modules/branding.ts` with:
  ```ts
  export async function getBrandingPublic(tenantId: string): Promise<BrandingConfig> {
    return apiRequest<BrandingConfig>(`/public/branding/${tenantId}`)
  }
  ```
  Note the fix: endpoint corrected from broken `/whitelabel/public` to real `/public/branding/:tenantId`, and `tenantId` becomes a required explicit parameter.
- `types/whitelabel.ts` → `types/branding.ts`
- `types/index.ts` — export path
- `src/index.ts` — top-level export names

### apps/backend
- New Prisma migration `<timestamp>_rename_whitelabel_permission_to_branding/migration.sql`:
  ```sql
  UPDATE "Permission" SET "subject" = 'branding' WHERE "subject" = 'whitelabel';
  ```
  Defensive: if no rows match, the migration is a no-op. No rollback needed in code; a manual reverse UPDATE is trivial if ever required.
- No module, schema, controller, seed, or handler changes — backend already uses `branding` throughout.

### apps/dashboard
- `app/(dashboard)/white-label/page.tsx` → `app/(dashboard)/branding/page.tsx`
- `components/features/white-label/branding-tab.tsx` → `components/features/branding/branding-form.tsx`
  (Component renamed `BrandingTab` → `BrandingForm`; it is a form, not a tab.)
- `hooks/use-whitelabel.ts` → `hooks/use-branding.ts`
  - `useWhitelabel` → `useBranding`
  - `useUpdateWhitelabel` → `useUpdateBranding`
  - queryKey `["whitelabel", "config"]` → `["branding", "config"]`
- `lib/api/whitelabel.ts` → `lib/api/branding.ts`
  - `fetchWhitelabel` → `fetchBranding`
  - `fetchPublicBranding` keeps its name
  - `updateWhitelabel` → `updateBranding`
- `lib/types/whitelabel.ts` → `lib/types/branding.ts`
  - `WhiteLabelConfig` → `BrandingConfig`
  - `UpdateWhitelabelPayload` → `UpdateBrandingPayload`
  - `PublicBranding` keeps its name
- `lib/translations/ar.whitelabel.ts` → `ar.branding.ts`
- `lib/translations/en.whitelabel.ts` → `en.branding.ts`
- `lib/translations/ar.ts` + `en.ts` — update imports; rename all `whiteLabel.*` keys to `branding.*`; move `settings.tabs.branding` into `branding.*` namespace or drop (no tabs exist)
- `lib/query-keys.ts` — rename `whitelabel` key group to `branding`
- `components/sidebar-config.ts` line 64:
  - `titleKey: "nav.whiteLabel"` → `"nav.branding"`
  - `href: "/white-label"` → `"/branding"`
  - `permission: "whitelabel:edit"` → `"branding:edit"`
- `eslint.config.mjs` — update `FEATURES` array (replace `whitelabel` with `branding`)
- Anywhere `canDo("whitelabel", "edit")` is called → `canDo("branding", "edit")` (currently `white-label/page.tsx`)
- `tokens.md` — rename references
- `README.md` — rename references
- `CODEOWNERS` — rename path
- `apps/dashboard/CLAUDE.md` — update dashboard routes list (`white-label/` → `branding/`)
- Tests:
  - `test/unit/hooks/use-whitelabel.spec.tsx` → `use-branding.spec.tsx`
  - `test/unit/lib/whitelabel-api.spec.ts` → `branding-api.spec.ts`
  - `test/unit/lib/query-keys.spec.ts` — update references
  - `test/e2e/settings/whitelabel.e2e-spec.ts` → `branding.e2e-spec.ts`
  - `test/e2e/settings/whitelabel-interactions.e2e-spec.ts` → `branding-interactions.e2e-spec.ts`
  - Inside each test, update route paths, selectors, and type imports

### apps/mobile
- `apps/mobile/theme/ThemeProvider.tsx` — update imports from `@carekit/shared` (`OrganizationTheme` → `BrandingConfig`, `DEFAULT_THEME` → `DEFAULT_BRANDING`) and from `@carekit/api-client` (`getTheme` → `getBrandingPublic(tenantId)`)

### Root documentation
- `CLAUDE.md` (root) — update the Key Domains table row for branding:
  - Domain column: `Whitelabel` → `Branding`
  - Backend Module: `whitelabel/` → `org-experience/branding/`
  - Dashboard Route: `settings/` → `branding/`
- `AGENTS.md` if it exists and mentions whitelabel — update

## CASL Migration — Safety Notes

1. **Permission storage model:** [apps/backend/prisma/schema/identity.prisma:70](apps/backend/prisma/schema/identity.prisma#L70) stores `action` and `subject` as separate columns with a unique constraint on `(customRoleId, action, subject)`. The rename is a single `UPDATE` on `subject`.
2. **Seed file:** [apps/backend/prisma/seed.ts](apps/backend/prisma/seed.ts) contains **no reference to `whitelabel`** — so the seed produces no `subject='whitelabel'` rows going forward. The defensive migration only matters if production has rows inserted outside the seed.
3. **JWT vs DB:** CASL permissions must be read from DB on each request (not cached in JWT) for the rename to propagate live without forcing re-login. **Pre-flight check required in implementation plan:** confirm `CaslGuard` reads from DB. If it reads from JWT claims, users with active sessions keep `whitelabel:edit` in their token and must log out/in. This is a discovery step in the implementation plan, not a blocker.
4. **Rollback:** manual reverse SQL `UPDATE "Permission" SET "subject" = 'whitelabel' WHERE "subject" = 'branding';` — instant, no data loss.

## Architecture Impact

- **Query cache invalidation on deploy:** users with stale dashboard tabs hold queryKey `["whitelabel", "config"]` in their TanStack Query cache. After deploy, the new code fetches with `["branding", "config"]` — a different key — so the old cache is simply orphaned and the new key triggers one fresh fetch. No action needed.
- **Mobile app re-deploy:** mobile consumes `@carekit/shared` and `@carekit/api-client`. It must be rebuilt and redeployed with the renamed types. The backend remains compatible because the endpoint URL did not change.
- **Dashboard bookmarks:** any user-bookmarked `/white-label` URL breaks with 404 after rename. Acceptable — this is a low-traffic admin page, and a redirect adds permanent legacy surface area for a problem that resolves itself in one visit.

## Sequencing (Inside the Branch)

The branch carries small internal commits for debugging, ending in a single squash-merge to `main`. Suggested order (each commit may break cross-package build until the next arrives; the branch build is verified only at the end):

1. `refactor(shared): rename theme → branding types`
2. `refactor(api-client): merge theme+whitelabel into branding, fix endpoint`
3. `feat(backend): defensive permission rename migration`
4. `refactor(dashboard): rename whitelabel → branding (core)` — route, page, component, hook, api, types, i18n
5. `refactor(dashboard): rename whitelabel → branding (peripherals)` — sidebar, eslint, auth check, tests
6. `refactor(mobile): consume renamed branding types`
7. `docs: update CLAUDE.md files and README for branding rename`

Final verification before squash-merge:

```bash
npm run build             # all workspaces
npm run typecheck         # dashboard + mobile + packages
npm run lint              # everything
npm run test              # unit
cd apps/backend && npm run prisma:migrate   # apply migration locally
cd apps/dashboard && npm run test:e2e       # e2e covers renamed routes
```

All must pass. Any failure blocks the squash-merge.

Squash-merge commit message on `main`:

```
refactor: rename whitelabel/theme → branding across monorepo

Unifies naming for the visual-identity feature. Renames:
- packages/shared types (OrganizationTheme → BrandingConfig)
- packages/api-client modules (merges theme+whitelabel into branding,
  fixes broken /whitelabel/public endpoint to /public/branding/:tenantId)
- Dashboard route, component, hook, api, types, i18n, sidebar, CASL ref
- Mobile ThemeProvider imports
- Defensive Prisma migration: Permission subject 'whitelabel' → 'branding'
- Root + dashboard CLAUDE.md updates

No backend module, schema, or endpoint changes — those were already 'branding'.
```

## Testing

- **Unit (dashboard):** renamed specs cover `useBranding` query behavior, `updateBranding` mutation, query key shape, API URL, translation keys present.
- **E2E (dashboard):** renamed Playwright specs navigate to `/branding`, assert permission guard (`branding:edit`), submit the form, verify persistence.
- **Backend:** existing `branding.handler.spec.ts` + `branding.controller.spec.ts` unchanged — they already use the correct names.
- **Migration smoke test:** run the migration on a dev DB with a seeded `subject='whitelabel'` row; confirm row now has `subject='branding'`; confirm running it again is a no-op.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| JWT-cached CASL permissions leave users stuck on old subject | Discovery step in implementation plan confirms DB-per-request. If JWT-cached, document forced logout as deploy step. |
| Missed reference in untested file causes runtime crash | Final `grep -ri "whitelabel\|WhiteLabel\|white-label" apps/ packages/ docs/` must return zero hits in source files before squash-merge. |
| Broken `/whitelabel/public` endpoint in api-client was in production use | Fix corrects a genuinely broken call site — no consumer is depending on the broken URL successfully. Mobile rebuild required anyway. |
| Root CLAUDE.md table drift after rename | Explicit item in the docs commit; grep verification before merge. |

## Implementation Plan

Next step: invoke `superpowers:writing-plans` to produce the step-by-step implementation plan with discovery steps, per-commit file lists, and verification commands.
