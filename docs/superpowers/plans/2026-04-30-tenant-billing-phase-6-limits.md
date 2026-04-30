# Tenant Billing Phase 6 Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden employee/branch plan-limit enforcement, add tenant-facing 80% warning and 100% blocking UX, and add a daily backend usage-warning cron.

**Architecture:** Keep enforcement in `PlanLimitsGuard` and keep employee login unaffected because the guard only sits on create endpoints. Count only active employees so deactivation opens a slot. Surface limits from existing subscription/usage data to dashboard banners and dialogs; backend warning cron records tenant notifications once when a threshold is crossed.

**Tech Stack:** NestJS 11, Prisma 7, Jest, Next.js 15, React Query, Vitest, Deqah UI, dashboard i18n.

---

## File Ownership

Phase 6 owns these files in this worktree:

- Modify `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts` and spec.
- Create `apps/backend/src/modules/platform/billing/send-limit-warning/` cron or handler files.
- Modify `apps/backend/src/modules/platform/billing/billing.module.ts`.
- Modify `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts` and `ops.module.ts` for cron registration.
- Modify dashboard billing status/usage UX and tests.
- Modify `apps/dashboard/lib/translations/en.billing.ts` and `ar.billing.ts` only for Phase 6 limit-warning keys.

Do not touch Phase 4 proration or plan-change handlers.

## Task 1: Guard Uses Active Employee Counts

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts`
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts`
- Optionally mirror in `apps/backend/src/modules/platform/billing/feature.guard.ts` if tests show the dashboard feature guard uses the same count.

- [ ] Write a failing test that `EMPLOYEES` calls `employee.count({ where: { organizationId, isActive: true } })`.
- [ ] Keep the existing blocked behavior at `current >= limit`.
- [ ] Confirm no login/auth controller uses `@EnforceLimit('EMPLOYEES')`; do not add enforcement to login.
- [ ] Implement the active-only count.
- [ ] Run `cd apps/backend && npx jest --silent src/modules/platform/billing/enforce-limits.guard.spec.ts --runInBand`.
- [ ] Commit: `fix(billing): enforce employee limits on active staff`.

## Task 2: Structured Limit-Reached Error

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.ts`
- Modify: `apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts`

- [ ] Write a failing test that the thrown `ForbiddenException` response includes:
  - `code: "PLAN_LIMIT_REACHED"`
  - `limitKind`
  - `current`
  - `limit`
- [ ] Implement without changing HTTP status.
- [ ] Keep human-readable message for old clients.
- [ ] Run targeted guard test.
- [ ] Commit: `feat(billing): return structured limit errors`.

## Task 3: 80% Usage Warning Cron

**Files:**
- Create: `apps/backend/src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`
- Modify: `apps/backend/src/modules/ops/ops.module.ts`

- [ ] Write failing tests for:
  - cron disabled does nothing.
  - finds active/trialing subscriptions with numeric `maxEmployees`.
  - counts active employees.
  - creates one `Notification` at 80% with `type: "GENERAL"`, owner recipient id, and metadata `{ kind: "EMPLOYEES", threshold: 80 }`.
  - skips when a matching notification already exists for the current period.
  - does not notify for unlimited or zero limits.
- [ ] Implement using `$allTenants.subscription.findMany` with plan included.
- [ ] Find owner via `$allTenants.membership.findFirst`.
- [ ] Create notification directly with `$allTenants.notification.create`; avoid pulling request-scoped `SendNotificationHandler` into cron.
- [ ] Register daily job name `usage-warnings`.
- [ ] Run targeted cron test.
- [ ] Commit: `feat(billing): send usage limit warnings`.

## Task 4: Dashboard Limit Warning Banner

**Files:**
- Modify: `apps/dashboard/components/features/billing/status-banner.tsx`
- Modify: `apps/dashboard/lib/billing/utils.ts`
- Modify: `apps/dashboard/test/unit/components/billing-page.spec.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`

- [ ] Write failing test that when active employee usage is 80-99%, billing page shows a light warning banner after dunning/scheduled-cancel priority.
- [ ] Implement helper that derives employee usage from keys `EMPLOYEES` and `employees`, limit key `maxEmployees`.
- [ ] Add i18n keys:
  - `billing.banner.limitWarning.title`
  - `billing.banner.limitWarning.description`
- [ ] Keep scheduled-cancel higher priority than limit warning.
- [ ] Run targeted dashboard test.
- [ ] Commit: `feat(dashboard): show billing limit warning banner`.

## Task 5: Dashboard Limit Reached Dialog

**Files:**
- Create: `apps/dashboard/components/features/billing/limit-reached-dialog.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/page.tsx` or a billing child component.
- Modify: `apps/dashboard/test/unit/components/billing-page.spec.tsx`
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`

- [ ] Write failing test that employee usage at 100% opens a dialog with upgrade CTA and close action.
- [ ] Implement dialog using existing `Dialog` primitives.
- [ ] Do not block page render; this is UX guidance, not route enforcement.
- [ ] Add i18n keys:
  - `billing.limitReached.title`
  - `billing.limitReached.description`
  - `billing.limitReached.upgrade`
  - `billing.limitReached.close`
- [ ] Run targeted dashboard test.
- [ ] Commit: `feat(dashboard): add limit reached dialog`.

## Task 6: Sidebar/Usage Widget Uses Employees

**Files:**
- Modify: `apps/dashboard/components/billing-usage-widget.tsx`
- Modify: `apps/dashboard/lib/billing/utils.ts`
- Modify: `apps/dashboard/test/unit/components/billing-usage-widget.spec.tsx`

- [ ] Write failing test that sidebar widget uses `EMPLOYEES/maxEmployees` instead of booking counts.
- [ ] Implement employee-first usage summary.
- [ ] Keep conservative fallback: render nothing when usage counters are absent.
- [ ] Run targeted widget tests.
- [ ] Commit: `fix(dashboard): show employee limit usage`.

## Task 7: OpenAPI and Verification

**Files:**
- Modify: `apps/backend/openapi.json` only if controller DTO metadata changes affects snapshot.

- [ ] If OpenAPI snapshot changed, refresh from this worktree:
  - `DOTENV_CONFIG_PATH=/Users/tariq/code/deqah/apps/backend/.env npm run openapi:build-and-snapshot --workspace=backend`
- [ ] Run backend billing tests:
  - `cd apps/backend && npx jest --silent src/modules/platform/billing/enforce-limits.guard.spec.ts src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.spec.ts --runInBand`
- [ ] Run full backend Jest:
  - `cd apps/backend && npx jest --silent --runInBand`
- [ ] Run dashboard targeted tests.
- [ ] Run backend and dashboard typechecks; note unrelated baseline failures.
- [ ] Commit OpenAPI if changed: `chore(openapi): refresh snapshot for billing phase 6`.

## Handoff

Before merge, report:

- Commit list.
- Backend Jest result.
- Dashboard test/typecheck result.
- Whether OpenAPI changed.
- Any known baseline failures outside Phase 6 scope.
