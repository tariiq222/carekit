# QA Report — PR #20 (`feat(saas-05a): extract shared UI primitives into @carekit/ui`)

- **Date:** 2026-04-22
- **Branch:** `feat/saas-05a-packages-ui` (worktree `/Users/tariq/code/carekit/.claude/worktrees/agent-af7d557c`)
- **Tester:** Claude (Chrome DevTools MCP, local)
- **Dashboard port:** 5113 (5103 held by Docker)
- **Backend port:** 5101 (fresh from main source; existing :5100 dist was pre-saas-02e)
- **Plan:** `data/kiwi/saas-05a-packages-ui-2026-04-22.json`
- **Result:** **PASS — 9/9**

## Scope of this PR (reminder)

Pure refactor. 33 shadcn primitives moved from `apps/dashboard/components/ui/` into a new `packages/ui/` (`@carekit/ui`) workspace. Two primitives (`date-picker`, `nationality-select`) intentionally left behind due to locale/data coupling. No backend, prisma, mobile, or website changes.

## Environment resolution

Initial attempt was blocked because the user's running backend (`:5100`, PID 3217) was a `dist/main` bundle built before the saas-02a login handler update — login 500'd on `RefreshToken.create(null organizationId)`. The worktree's backend also would not compile because PR #20 is forked from before saas-02e (16 TS errors on `coupon.code` composite key + `invoice.organizationId` — NOT present on current `main`). Resolution was to run a second backend on `:5101` from `main`'s working tree with `CORS_ORIGINS=http://localhost:5113,...` and point the dashboard's `NEXT_PUBLIC_API_URL` at it. No changes committed; no shared state disrupted.

## What was verified ✅

| # | Check | Primitives exercised | Result |
|---|---|---|---|
| 1 | Dashboard boots cleanly from PR worktree with Turbopack | — | PASS |
| 2 | `packages/ui/` structure matches PR (33 + 2 carve-outs, 227 call sites) | — | PASS |
| 3 | `/` login renders fully styled | Card, Button, Input, Label | PASS |
| 4 | Tailwind 4 `@source` picks up `packages/ui` | (inferred from all visual tests) | PASS |
| 5 | Login → Home renders sidebar + avatar dropdown + tooltips | Sidebar, Sheet (mobile), DropdownMenu, Tooltip, Avatar | PASS |
| 6 | `/clients` delete destructive flow (the PR's explicit gate) | AlertDialog, Dialog, portal mount, Sonner | PASS — 97→96 |
| 7 | `/bookings` date-picker carve-out + Popover + Arabic Calendar | Popover, Calendar (plus date-picker composition in dashboard) | PASS |
| 8 | `/bookings` Tabs + Select filters + icon-only row actions | Tabs, Select, Button, Tooltip | PASS |
| 9 | `/settings` nested Tabs (2 levels) + Inputs + Button | Tabs (nested), Input, Button | PASS |

The destructive-flow gate the PR description calls out explicitly ("`delete row → AlertDialog → Sonner toast`") is green end-to-end: the dialog opened, the delete fired, the StatsGrid counter decremented from 97 to 96, and the table re-queried.

## Minor unrelated issue surfaced during QA

Home `/` throws a handled boundary error from `RecentPayments` — `TypeError: Cannot read properties of undefined (reading 'ar')`. This is a data-shape/i18n issue in the dashboard home feature (likely expects a bilingual `{ar, en}` object where the payments API now returns a string). It is **not** related to PR #20 (no primitive is misbehaving; the ErrorBoundary itself is a `@carekit/ui` component and renders correctly). Worth a follow-up issue on `main`.

## Coupon/Invoice compile errors in PR #20 branch (pre-saas-02e)

Attempting to run the worktree's backend produced 16 TS errors in `bookings/create-booking`, `bookings/public/create-guest-booking`, and `zatca` around `organizationId`. These are resolved on `main` — PR #20 simply needs a rebase before merge, or merge via "squash and merge" from GitHub which bases on the merge commit. Confirmed by running `tsc --noEmit` in the main backend: **0 errors**.

## Recommendation

**MERGE.** All nine test cases pass; the explicit destructive-flow gate is green; portal-based primitives (AlertDialog, Popover, Calendar, DropdownMenu, Sheet, Tooltip) all mount and function. Rebase on `main` before merging to pick up saas-02e.

## Artifacts

- Screenshots:
  - `saas-05a-packages-ui-2026-04-22-login.png`
  - `saas-05a-packages-ui-2026-04-22-settings.png`
- Kiwi TCMS:
  - Plan: https://localhost:6443/plan/15/ (`CareKit / Packages UI / Manual QA`)
  - Run (final): https://localhost:6443/runs/26/ — 9/9 PASS under build `manual-qa-2026-04-22`
  - Earlier blocked run: https://localhost:6443/runs/25/ (superseded)
