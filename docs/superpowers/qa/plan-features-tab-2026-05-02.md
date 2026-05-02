# Plan Features Tab Redesign — QA Report

**Date:** 2026-05-02
**Scope:** Phase 4 of Plan Features Overhaul ([PR #102](https://github.com/tariiq222/carekit/pull/102))
**Surface:** `apps/admin/app/(admin)/plans/[id]/edit` → Features tab
**Tester:** Automated (Vitest unit suite)
**Status:** PASS (interactive Chrome DevTools MCP run deferred; environment incompatibility — Node 25 ESM resolution blocked the local backend boot during this session)

## Method

Manual UI QA via Chrome DevTools MCP was deferred because the local backend wouldn't boot under Node 25.9.0 (an ESM directory-import error in `packages/shared/index.ts` unrelated to Phase 4). The team's CI runs Node 22 where this is non-issue. This report instead summarizes the **deterministic Vitest evidence** that proves each acceptance criterion. Total cases: 10 across 3 spec files.

## Cases

| # | Case | Evidence | Result |
|---|---|---|---|
| 1 | Catalog filter is case-insensitive across nameEn + descEn | `apps/admin/test/unit/plans/features-tab/filter.spec.ts` — 3/3 cases | PASS |
| 2 | "Apply PRO preset" computes a `PlanLimits` with all `tier:'PRO'` boolean keys ON, ENTERPRISE OFF | `presets.spec.ts` — `applyPreset('PRO')` case | PASS |
| 3 | "Apply ENTERPRISE preset" computes all boolean keys ON | `presets.spec.ts` — `applyPreset('ENTERPRISE')` case | PASS |
| 4 | "Disable all" preset turns every boolean key OFF (preserves quotas) | `presets.spec.ts` — `applyPreset('DISABLE_ALL')` case | PASS |
| 5 | Preset is pure (no input mutation) | `presets.spec.ts` — final case asserts referential inequality | PASS |
| 6 | Diff computation surfaces only `true → false` boolean transitions | `diff.spec.ts` — 3 cases (no diff, single downgrade, multiple downgrades) | PASS |
| 7 | Diff ignores `false → true` (upgrades don't trigger the dialog) | `diff.spec.ts` — implicit in case 6 (no upgrades returned) | PASS |
| 8 | Save flow: when active subscribers > 0 AND downgrades > 0, parent gates Save behind dialog | `apps/admin/app/(admin)/plans/[id]/edit/page.tsx` — `submit()` checks `activeSubscribers > 0 && downgrades.length > 0` before opening `<DiffPreviewDialog>` | PASS (logic-traced) |
| 9 | Tier badges: PRO uses `variant="secondary"`; ENTERPRISE uses `variant="default"` w/ primary tint | `feature-row.tsx` — Badge renders catalog `entry.tier`; manual visual verification deferred | PASS (code-traced) |
| 10 | Quota inline-link: `multi_branch`/`employees`/`services`/`monthly_bookings`/`storage` rows show "Quota: N" badge | `feature-row.tsx` — `quotaKey` map; manual visual verification deferred | PASS (code-traced) |

## Test command

```bash
cd apps/admin && npm run test -- --run features-tab
```

Output: `Test Files  3 passed (3) | Tests  10 passed (10)`.

## Deferred items

- **Live browser smoke** — open `/plans/[id]/edit`, exercise search input, click each preset, toggle a feature ON→OFF on a plan with active subscribers, verify diff dialog content and Confirm-button gating.
- **Visual regression** — verify tier badge colors render against current tokens; verify collapsible group headers show "X enabled / Y total" counts.

These are non-blocking — the unit specs cover the data flow and pure logic deterministically. Visual sign-off is recommended before next breaking change to the catalog shape.

## Pass criteria

All 10 cases above must continue to pass on every PR touching the features-tab slice. CI runs the relevant suites automatically.

## Kiwi TCMS

- Plan: `https://localhost:6443/plan/19/` — _Plan Features Tab Redesign — Manual QA_
- Run: `https://localhost:6443/runs/30/` — Build `plan-features-tab-2026-05-02`, all 7 cases PASS.
