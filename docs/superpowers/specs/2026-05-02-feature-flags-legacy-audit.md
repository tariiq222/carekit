# Legacy `feature-flags.ts` Importer Audit — 2026-05-02

Phase 2 of the Plan Features Overhaul. Decision per call site below.

| # | Path | Symbol used | Decision | Notes |
|---|---|---|---|---|
| 1 | `packages/shared/constants/feature-flags.ts` | self (the file) | **DELETE** in Task 4 | The legacy 13-key array. |
| 2 | `packages/shared/constants/index.ts` | re-exports `FEATURE_FLAG_KEYS`, `FeatureFlagKey` | **DELETE the re-export lines** in Task 4 | Keep `FeatureKey` re-export untouched. |
| 3 | `apps/dashboard/test/unit/components/sidebar-config.spec.tsx` | comment only | **EDIT comment** in Task 2 | Comment references the legacy list; rewrite to mention only `FeatureKey`. |
| 4 | `apps/dashboard/test/unit/shared/constants/feature-flags.spec.ts` | `FEATURE_FLAG_KEYS`, `FeatureFlagKey` | **DELETE the file** in Task 2 | Pure test of the dying array — no migration value. |

## Keys that exist in legacy but NOT in `FeatureKey` enum

These 7 keys are scheduled for Phase 3 of the overhaul and are explicitly NOT migrated in Phase 2:

- `chatbot` (Phase 3 — distinct from `AI_CHATBOT`? confirm in Phase 3 catalog work)
- `multi_branch` (Phase 3)
- `walk_in` (Phase 3 — `walk_in_bookings` per spec)
- `zoom` (Phase 3 — `zoom_integration` per spec)
- `departments` (Phase 3)
- `groups` (Phase 3)
- `ratings` (Phase 3 — `client_ratings` per spec)

**Risk note:** if any production data references these strings (e.g. seeded `FeatureFlag` rows with `key='chatbot'`), Phase 3 must include a data migration. Phase 2 changes only TypeScript surfaces, no DB rows.

## Mobile is out of scope

`apps/mobile/constants/feature-flags.ts` exports a different symbol (`FEATURE_FLAGS = { videoCalls: false }`) — build-time gates, not billing keys. Not touched in Phase 2.

## API endpoints under `/feature-flags` are out of scope

The platform `FeatureFlag` Prisma model and `/admin/feature-flags`, `/dashboard/platform/feature-flags` HTTP endpoints are unrelated to the legacy `FEATURE_FLAG_KEYS` array — they back the per-org override mechanism scheduled for Phase 6. Not touched in Phase 2.
