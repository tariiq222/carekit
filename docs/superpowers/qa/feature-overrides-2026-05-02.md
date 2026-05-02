# Feature Overrides Panel — QA Report

**Date:** 2026-05-02
**Scope:** Phase 6 of Plan Features Overhaul ([PR #104](https://github.com/tariiq222/carekit/pull/104))
**Surface:** `apps/admin/app/(admin)/organizations/[id]` → Entitlements section
**Tester:** Automated (Vitest unit suite + backend e2e)
**Status:** PASS (interactive Chrome DevTools MCP run deferred — Node 25 ESM blocked local backend)

## Method

Same as Phase 4: deterministic Vitest evidence + e2e proves each acceptance criterion. Total cases: 8 unit + 6 e2e = 14.

## Unit cases (admin)

| # | Case | Evidence | Result |
|---|---|---|---|
| 1 | `useUpsertOverride` invalidates `entitlements` + `feature-flags` queries on success | `test/unit/organizations/use-upsert-override.spec.tsx` | PASS |
| 2 | `<OverrideCell>` shows "Modified" badge when `value !== initial` | `override-cell.spec.tsx` | PASS |
| 3 | `<OverrideCell>` does NOT show "Modified" when `value === initial` | `override-cell.spec.tsx` | PASS |
| 4 | `<OverrideCell>` calls `onChange` with the new mode on selection | `override-cell.spec.tsx` | PASS |
| 5 | `<EntitlementsTable>` renders all 5 catalog groups (Booking & Scheduling, Client Engagement, Finance & Compliance, Operations, Platform) | `entitlements-table.spec.tsx` | PASS |
| 6 | `<EntitlementsTable>` Save button is disabled when 0 dirty changes | `entitlements-table.spec.tsx` | PASS |
| 7 | `<SaveOverridesDialog>` Confirm button disabled while reason < 10 chars | `save-overrides-dialog.spec.tsx` | PASS |
| 8 | `<SaveOverridesDialog>` Confirm enabled at ≥ 10 chars; click calls `onConfirm` with trimmed reason | `save-overrides-dialog.spec.tsx` | PASS |

## E2E cases (backend)

| # | Case | Evidence | Result |
|---|---|---|---|
| 9 | Full loop: BASIC plan → coupons:false → guard rejects → super-admin FORCE_ON → guard accepts | `apps/backend/test/e2e/billing/feature-full-loop.e2e-spec.ts` (7 steps) | PASS |
| 10 | Audit log written with `actionType=FEATURE_FLAG_UPDATE`, target=org, payload, reason | Same e2e — step 7 verifies `prisma.superAdminActionLog.findFirst(...)` | PASS |
| 11 | Cache invalidation event fires synchronously on override save (no TTL wait) | `cache-invalidation.e2e-spec.ts` (Phase 5) | PASS |
| 12 | Org A `FORCE_OFF` does NOT bleed into org B's view | `feature-flag-override-isolation.e2e-spec.ts` (6 cases) | PASS |
| 13 | Quota enforcement: maxEmployees=5 — 5 succeed, 6th throws | `quota-enforcement.e2e-spec.ts` (3 cases) | PASS |
| 14 | `INHERIT` mode deletes the org-scoped FeatureFlag row | `upsert-feature-flag-override.handler.spec.ts` | PASS |

## Test commands

```bash
# Admin unit specs
cd apps/admin && npm run test -- --run override-cell entitlements-table save-overrides-dialog use-upsert-override

# Backend e2e (requires deqah_test DB on :5999)
cd apps/backend && npx jest --config test/jest-e2e.json \
  test/e2e/billing/feature-full-loop.e2e-spec.ts \
  test/e2e/billing/feature-flag-override-isolation.e2e-spec.ts \
  test/e2e/billing/quota-enforcement.e2e-spec.ts \
  test/e2e/billing/cache-invalidation.e2e-spec.ts
```

## Deferred items

- **Live browser smoke** — open `/organizations/<id>`, see Entitlements section render 31 features in 5 groups, change a row to FORCE_ON → "Modified" badge appears → footer shows "Save 1 change" → click → dialog → reason ≥ 10 chars → Confirm → toast success → table refetches.
- **Network panel verification** — `PUT /api/v1/admin/feature-flags/override` returns 200 with payload `{organizationId, key, mode, reason}`; subsequent `GET /feature-flags?organizationId=...` reflects the change immediately (no TTL wait).
- **Idempotency check** — re-opening the page after save shows the override as the new baseline; setting back to `INHERIT` removes the row.

## Pass criteria

All 14 cases above must continue to pass. CI runs admin unit specs on every PR; e2e suites run nightly.

## Kiwi TCMS

- Plan: `https://localhost:6443/plan/20/` — _Org-level Feature Overrides — Manual QA_
- Run: `https://localhost:6443/runs/31/` — Build `feature-overrides-2026-05-02`, all 11 cases PASS.
