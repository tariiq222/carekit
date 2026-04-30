# Tenant Billing Phase 4 Proration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-facing proration preview, immediate paid upgrades, scheduled downgrades, undo scheduled downgrades, scheduled downgrade processing, and the `/settings/billing/plans` dashboard page.

**Architecture:** Keep proration math in a pure helper so edge cases are unit tested without Nest setup. Upgrades are immediate only after a successful default-card Moyasar token charge; downgrades are scheduled on the subscription and processed by a daily cron at `currentPeriodEnd`. Dashboard plan switching calls the preview endpoint first, then either upgrades or schedules the downgrade.

**Tech Stack:** NestJS 11, Prisma 7 migrations, Moyasar token charges via `MoyasarSubscriptionClient`, Jest, Next.js 15, React Query, Vitest, CareKit UI, custom dashboard i18n.

---

## File Ownership

Phase 4 owns these files in this worktree:

- Create migration under `apps/backend/prisma/migrations/20260430150000_tenant_billing_proration/`.
- Modify `apps/backend/prisma/schema/platform.prisma` for scheduled plan-change fields.
- Create backend slices under `apps/backend/src/modules/platform/billing/compute-proration/`, `schedule-downgrade/`, `cancel-scheduled-downgrade/`, and `process-scheduled-plan-changes/`.
- Modify `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.ts`.
- Modify `apps/backend/src/modules/platform/billing/billing.module.ts`.
- Modify `apps/backend/src/api/dashboard/billing.controller.ts`.
- Modify dashboard billing API/types/hooks.
- Create `/settings/billing/plans` page and small local components.
- Modify `apps/dashboard/lib/translations/en.billing.ts` and `ar.billing.ts` only for Phase 4 plan/proration keys.

Do not touch Phase 6 limit-warning files except shared translations if unavoidable.

## Task 1: Schema and Scheduled Plan Fields

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Create: `apps/backend/prisma/migrations/20260430150000_tenant_billing_proration/migration.sql`

- [ ] Write migration and schema fields:
  - `Subscription.scheduledPlanId String?`
  - `Subscription.scheduledPlan Plan? @relation("SubscriptionScheduledPlan", fields: [scheduledPlanId], references: [id], onDelete: SetNull)`
  - `Subscription.scheduledBillingCycle BillingCycle?`
  - `Subscription.scheduledPlanChangeAt DateTime?`
  - Add inverse relation on `Plan`: `scheduledSubscriptions Subscription[] @relation("SubscriptionScheduledPlan")`
  - Add index: `@@index([scheduledPlanChangeAt])`
- [ ] Run `npm run prisma:validate --workspace=backend`.
- [ ] Commit: `feat(billing): add scheduled plan change fields`.

## Task 2: Pure Proration Calculator

**Files:**
- Create: `apps/backend/src/modules/platform/billing/compute-proration/proration-calculator.ts`
- Create: `apps/backend/src/modules/platform/billing/compute-proration/proration-calculator.spec.ts`

- [ ] Write failing Jest cases first:
  - day 1 of a 30-day monthly period charges nearly the full positive difference.
  - day 29 charges only remaining-period difference.
  - expired period clamps to zero.
  - downgrade or equal target returns zero and `isUpgrade=false`.
  - annual target uses annual target price.
- [ ] Implement `computeProrationAmountSar(input)` returning:
  - `amountSar`
  - `amountHalalas`
  - `remainingRatio`
  - `periodStart`
  - `periodEnd`
  - `isUpgrade`
- [ ] Use integer halalas internally; never use floats for final charge amount.
- [ ] Run targeted Jest for calculator.
- [ ] Commit: `feat(billing): add proration calculator`.

## Task 3: Proration Preview Handler

**Files:**
- Create: `apps/backend/src/modules/platform/billing/compute-proration/compute-proration.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/compute-proration/compute-proration.handler.spec.ts`
- Create or extend DTOs in `apps/backend/src/modules/platform/billing/dto/change-plan.dto.ts`

- [ ] Write failing tests for:
  - no subscription -> `NotFoundException`
  - inactive target plan -> `NotFoundException`
  - upgrade returns `action: "UPGRADE_NOW"` and prorated charge
  - downgrade returns `action: "SCHEDULE_DOWNGRADE"` and `effectiveAt=currentPeriodEnd`
  - canceled/suspended subscription rejects
  - `cancelAtPeriodEnd=true` upgrade clears the cancellation warning in the response expectation later
- [ ] Implement handler using current tenant subscription and target plan.
- [ ] Add controller endpoint:
  - `GET /dashboard/billing/subscription/proration-preview?planId=...&billingCycle=...`
- [ ] Run handler/controller targeted tests.
- [ ] Commit: `feat(billing): preview prorated plan changes`.

## Task 4: Paid Upgrade With Saved Default Card

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/upgrade-plan/upgrade-plan.handler.spec.ts`

- [ ] Write failing tests for:
  - upgrade requires a default saved card or `moyasarCardTokenRef`.
  - upgrade creates a proration invoice with a `PRORATION` line item.
  - upgrade calls `MoyasarSubscriptionClient.chargeWithToken` with integer halalas and `givenId`.
  - `status !== paid` rejects and does not update the subscription.
  - successful upgrade updates `planId`, `billingCycle`, clears scheduled cancellation, clears scheduled downgrade, records payment, invalidates cache, and emails owner.
- [ ] Implement minimal code to pass.
- [ ] For non-paid Moyasar statuses, reject with `UnprocessableEntityException`.
- [ ] Do not fulfill or change plan on `initiated`.
- [ ] Run targeted upgrade tests.
- [ ] Commit: `feat(billing): charge prorated upgrades`.

## Task 5: Scheduled Downgrade and Undo

**Files:**
- Create: `apps/backend/src/modules/platform/billing/schedule-downgrade/schedule-downgrade.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/schedule-downgrade/schedule-downgrade.handler.spec.ts`
- Create: `apps/backend/src/modules/platform/billing/cancel-scheduled-downgrade/cancel-scheduled-downgrade.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/cancel-scheduled-downgrade/cancel-scheduled-downgrade.handler.spec.ts`

- [ ] Write failing tests for scheduling a downgrade:
  - target must be lower price for the requested cycle.
  - stores `scheduledPlanId`, `scheduledBillingCycle`, `scheduledPlanChangeAt=currentPeriodEnd`.
  - does not immediately change `planId`.
  - clears `cancelAtPeriodEnd` when user schedules downgrade after a cancellation, only if spec edge case needs active continuation.
- [ ] Write failing tests for undo:
  - no scheduled downgrade rejects.
  - clears all scheduled plan fields and invalidates cache.
- [ ] Implement handlers.
- [ ] Add controller endpoints:
  - `POST /dashboard/billing/subscription/schedule-downgrade`
  - `POST /dashboard/billing/subscription/cancel-scheduled-downgrade`
- [ ] Keep existing `POST /subscription/downgrade` backward-compatible by delegating to schedule-downgrade.
- [ ] Run targeted tests.
- [ ] Commit: `feat(billing): schedule plan downgrades`.

## Task 6: Process Scheduled Plan Changes Cron

**Files:**
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`
- Modify: `apps/backend/src/modules/ops/ops.module.ts`

- [ ] Write failing tests for cron disabled, query shape, applying due changes, clearing scheduled fields, and cache invalidation.
- [ ] Implement cron using `$allTenants.subscription.findMany`.
- [ ] Register daily job name `process-scheduled-plan-changes`.
- [ ] Run targeted cron tests.
- [ ] Commit: `feat(billing): process scheduled plan changes`.

## Task 7: Dashboard API, Hooks, and Types

**Files:**
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Modify or add tests under `apps/dashboard/test/unit/lib/`

- [ ] Write failing Vitest assertions for new API paths.
- [ ] Add `ProrationPreview`, scheduled plan fields, and mutation helpers.
- [ ] Add React Query hooks/mutations for preview, upgrade, schedule downgrade, and cancel scheduled downgrade.
- [ ] Run dashboard unit tests for billing API/hooks.
- [ ] Commit: `feat(dashboard): add plan change billing client`.

## Task 8: `/settings/billing/plans` Page

**Files:**
- Create: `apps/dashboard/app/(dashboard)/settings/billing/plans/page.tsx`
- Create local components under `apps/dashboard/app/(dashboard)/settings/billing/plans/components/`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/components/plan-change-dialog.tsx` if reused
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Add or modify dashboard component tests.

- [ ] Write failing component tests for:
  - monthly/annual segmented control.
  - current plan badge.
  - upgrade preview text `Pay X SAR now`.
  - downgrade preview text `Scheduled for {date}`.
  - cancel scheduled downgrade action when subscription already has one.
- [ ] Implement page with Page Anatomy Law: `Breadcrumbs -> PageHeader -> ErrorBanner/Status -> plan grid -> feature matrix -> dialogs`.
- [ ] Use semantic tokens and logical spacing only.
- [ ] Run targeted Vitest.
- [ ] Commit: `feat(dashboard): add billing plans page`.

## Task 9: OpenAPI and Verification

**Files:**
- Modify: `apps/backend/openapi.json`
- Possibly regenerate: `apps/dashboard/lib/types/api.generated.ts` if the repo expects it tracked.

- [ ] Build backend then refresh local snapshot from this worktree, not another server:
  - `DOTENV_CONFIG_PATH=/Users/tariq/code/carekit/apps/backend/.env npm run openapi:build-and-snapshot --workspace=backend`
- [ ] Run backend targeted billing tests.
- [ ] Run `cd apps/backend && npx jest --silent --runInBand`.
- [ ] Run dashboard targeted tests.
- [ ] Run `npm run typecheck --workspace=backend`.
- [ ] Run `npm run typecheck --workspace=dashboard` and note any unrelated baseline failures.
- [ ] Commit: `chore(openapi): refresh snapshot for billing phase 4`.

## Handoff

Before merge, report:

- Commit list.
- Backend Jest result.
- Dashboard test/typecheck result.
- OpenAPI snapshot state.
- Any known baseline failures outside Phase 4 scope.
