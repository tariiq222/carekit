# Tenant Billing Phase 5 Dunning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smart retry dunning for failed subscription payments, including DunningLog audit history, hourly retry cron, manual retry endpoint, dunning email, and tenant-facing dashboard recovery banner.

**Architecture:** Dunning starts when `RecordSubscriptionPaymentFailureHandler` records a failed subscription invoice: the subscription becomes `PAST_DUE`, `dunningRetryCount` is initialized, `nextRetryAt` is scheduled, and a `DunningLog` row records the failure. Cron and manual retry share the same retry budget and always re-resolve the current default saved card before charging so card changes during dunning are honored. Moyasar retry payments treat only `paid` as success; `initiated`/3DS statuses are rejected and logged as failed because cron/manual retry has no interactive 3DS flow.

**Tech Stack:** NestJS 11, Prisma 7 migrations/RLS, Moyasar token charges, Resend templates, Jest, Next.js 15, React Query, Vitest, CareKit UI, dashboard i18n.

---

## File Ownership

Phase 5 owns these files in this worktree:

- Create migration under `apps/backend/prisma/migrations/20260430160000_tenant_billing_dunning/`.
- Modify `apps/backend/prisma/schema/platform.prisma` for `Subscription.dunningRetryCount`, `Subscription.nextRetryAt`, and `DunningLog`.
- Modify `apps/backend/src/infrastructure/database/prisma.service.ts` to scope `DunningLog`.
- Create backend retry slices under `apps/backend/src/modules/platform/billing/retry-failed-payment/` and `dunning-retry/`.
- Modify `record-subscription-payment-failure`, `record-subscription-payment`, and `saved-cards/add-saved-card` to enter, clear, or re-arm dunning.
- Modify `apps/backend/src/modules/platform/billing/billing.module.ts`.
- Modify `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`, spec, and `ops.module.ts`.
- Modify `apps/backend/src/api/dashboard/billing.controller.ts` and spec for `POST /dashboard/billing/subscription/retry-payment`.
- Create `apps/backend/src/infrastructure/mail/templates/dunning-retry.template.ts` and extend `PlatformMailerService`.
- Modify dashboard billing API/types/hooks, overview page/banner, billing translations, and tests.
- Refresh `apps/backend/openapi.json` if the retry endpoint changes the snapshot.

Do not touch the unrelated branding sanitizer files currently dirty in the main checkout.

## Phase Decisions

- The failed charge that starts dunning logs `attemptNumber: 0` with status `FAILED`; paid retries use attempt numbers `1..4`.
- `dunningRetryCount` counts executed dunning retry attempts, not the original failed charge.
- `nextRetryAt` starts at `failedAt + 3h`, then failed retries schedule `[1d, 3d, 7d]` for attempts `1..3`; after the fourth failed retry the subscription becomes `SUSPENDED` and `nextRetryAt` is cleared.
- Manual retry uses the same next attempt number as cron and increments the same `dunningRetryCount`; it can run before `nextRetryAt`, but it is not a free retry.
- Every retry re-loads the current default saved card from `SavedCard` and does not trust stale `moyasarCardTokenRef`.
- Idempotency keys use `dunning:${invoiceId}:${attemptNumber}` and are also sent as Moyasar `givenId`.
- Any Moyasar status other than `paid`, including `initiated`, is logged as failed and does not mark the invoice paid.
- Adding a default card while `PAST_DUE` resets `dunningRetryCount` to `0` and sets `nextRetryAt` to `now`, so the next cron run can retry immediately with the new card.

## Task 1: Schema, RLS, and Prisma Model

**Files:**
- Modify: `apps/backend/prisma/schema/platform.prisma`
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`
- Create: `apps/backend/prisma/migrations/20260430160000_tenant_billing_dunning/migration.sql`

- [ ] Write the migration:
  - `ALTER TABLE "Subscription" ADD COLUMN "dunningRetryCount" INTEGER NOT NULL DEFAULT 0;`
  - `ALTER TABLE "Subscription" ADD COLUMN "nextRetryAt" TIMESTAMP(3);`
  - `CREATE TABLE "DunningLog"` with `id`, `organizationId`, `subscriptionId`, `invoiceId`, `attemptNumber`, `status`, `moyasarPaymentId`, `failureReason`, `scheduledFor`, `executedAt`.
  - Add indexes on `organizationId`, `subscriptionId`, `invoiceId`, and unique `(invoiceId, attemptNumber)`.
  - Enable and force RLS with `tenant_isolation_dunning_log`.
- [ ] Mirror the model in Prisma:
  - Add scalar fields on `Subscription`.
  - Add `dunningLogs DunningLog[]` on `Subscription` and `SubscriptionInvoice`.
  - Add `model DunningLog`.
- [ ] Add `'DunningLog'` to `SCOPED_MODELS`.
- [ ] Run `npm run prisma:validate --workspace=backend`.
- [ ] Commit: `feat(billing): add dunning schema`.

## Task 2: Payment Failure Starts Dunning

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.spec.ts`

- [ ] Write failing tests that:
  - `ACTIVE -> PAST_DUE` sets `dunningRetryCount: 0` and `nextRetryAt` to the first retry window.
  - Existing `PAST_DUE` keeps existing `pastDueSince` but re-arms `nextRetryAt` if it was null.
  - A `DunningLog` row is created with `attemptNumber: 0`, `status: "FAILED"`, `invoiceId`, `moyasarPaymentId`, `failureReason`, `scheduledFor`, and `executedAt`.
- [ ] Implement minimal updates inside the existing transaction.
- [ ] Preserve existing email and cache invalidation behavior.
- [ ] Run `cd apps/backend && npx jest --silent src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.spec.ts --runInBand`.
- [ ] Commit: `feat(billing): start dunning on failed subscription payments`.

## Task 3: Shared Dunning Retry Service

**Files:**
- Create: `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.service.ts`
- Create: `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.service.spec.ts`

- [ ] Write failing tests for:
  - no default saved card logs a failed attempt and schedules the next retry.
  - every attempt re-resolves `savedCard.findFirst({ organizationId, isDefault: true })`.
  - retry charges Moyasar with `idempotencyKey: dunning:${invoiceId}:${attemptNumber}` and the same `givenId`.
  - `paid` calls `RecordSubscriptionPaymentHandler`, clears dunning fields, and returns `status: "PAID"`.
  - `initiated` is treated as failed, not paid.
  - fourth failed retry suspends the subscription and clears `nextRetryAt`.
- [ ] Implement constants:
  - `DUNNING_MAX_RETRIES = 4`
  - `DUNNING_RETRY_DELAYS_MS = [3h, 1d, 3d, 7d]`
- [ ] Implement `retryInvoice({ subscription, invoice, manual, now })`.
- [ ] Update `Subscription.dunningRetryCount` with the executed attempt number on failure.
- [ ] Create `DunningLog` for every retry result.
- [ ] Run targeted service tests.
- [ ] Commit: `feat(billing): add dunning retry service`.

## Task 4: Hourly Dunning Retry Cron

**Files:**
- Create: `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.cron.ts`
- Create: `apps/backend/src/modules/platform/billing/dunning-retry/dunning-retry.cron.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.ts`
- Modify: `apps/backend/src/modules/ops/cron-tasks/cron-tasks.service.spec.ts`
- Modify: `apps/backend/src/modules/ops/ops.module.ts`

- [ ] Write failing cron tests for:
  - `BILLING_CRON_ENABLED=false` does nothing.
  - Query includes `status: "PAST_DUE"` and `nextRetryAt <= now`.
  - It picks the latest `FAILED`/`DUE` invoice per subscription.
  - It delegates to `DunningRetryService`.
  - Cron registry schedules `dunning-retry` hourly and routes the worker to the cron.
- [ ] Implement cron with `$allTenants.subscription.findMany`.
- [ ] Register `DUNNING_RETRY: "dunning-retry"` in `CRON_JOBS`.
- [ ] Run targeted cron and cron registry tests.
- [ ] Commit: `feat(billing): retry dunning invoices hourly`.

## Task 5: Manual Retry Endpoint

**Files:**
- Create: `apps/backend/src/modules/platform/billing/retry-failed-payment/retry-failed-payment.handler.ts`
- Create: `apps/backend/src/modules/platform/billing/retry-failed-payment/retry-failed-payment.handler.spec.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.ts`
- Modify: `apps/backend/src/api/dashboard/billing.controller.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/billing.module.ts`

- [ ] Write failing handler tests for:
  - no current tenant subscription -> `NotFoundException`.
  - subscription not `PAST_DUE` -> `UnprocessableEntityException`.
  - exhausted retry budget -> `UnprocessableEntityException`.
  - manual retry before `nextRetryAt` still delegates and consumes the next attempt.
  - successful manual retry returns `{ ok: true, status: "PAID" }`.
- [ ] Implement handler using `TenantContextService.requireOrganizationId()`.
- [ ] Add controller route:
  - `POST /dashboard/billing/subscription/retry-payment`
- [ ] Run handler/controller tests.
- [ ] Commit: `feat(billing): add manual dunning retry endpoint`.

## Task 6: Clear and Re-arm Dunning on Success/Card Changes

**Files:**
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.spec.ts`
- Modify: `apps/backend/src/modules/platform/billing/saved-cards/add-saved-card.handler.ts`
- Modify: `apps/backend/src/modules/platform/billing/saved-cards/saved-cards.handlers.spec.ts`

- [ ] Write failing success tests that payment success clears `dunningRetryCount`, `nextRetryAt`, `pastDueSince`, and `lastFailureReason`.
- [ ] Write failing saved-card test that adding/defaulting a card for a `PAST_DUE` subscription resets `dunningRetryCount: 0` and sets `nextRetryAt` to `now`.
- [ ] Implement minimal updates in existing transactions.
- [ ] Run targeted payment and saved-card tests.
- [ ] Commit: `fix(billing): reset dunning after payment recovery`.

## Task 7: Dunning Email Template

**Files:**
- Create: `apps/backend/src/infrastructure/mail/templates/dunning-retry.template.ts`
- Modify: `apps/backend/src/infrastructure/mail/platform-mailer.service.ts`
- Add/modify tests under `apps/backend/src/infrastructure/mail/templates/__tests__/templates.spec.ts`

- [ ] Write failing template test for bilingual Arabic/English output with attempt number, amount, reason, and billing URL.
- [ ] Implement `dunningRetryTemplate(vars)`.
- [ ] Add `PlatformMailerService.sendDunningRetry(...)`.
- [ ] Call the template from `DunningRetryService` after failed attempts when an owner email exists.
- [ ] Keep mail best-effort; retry flow must not fail if Resend is unavailable.
- [ ] Run template and dunning service tests.
- [ ] Commit: `feat(billing): add dunning retry email`.

## Task 8: Dashboard Dunning Banner and Retry CTA

**Files:**
- Modify: `apps/dashboard/lib/types/billing.ts`
- Modify: `apps/dashboard/lib/api/billing.ts`
- Modify: `apps/dashboard/hooks/use-current-subscription.ts`
- Modify: `apps/dashboard/components/features/billing/status-banner.tsx`
- Modify: `apps/dashboard/app/(dashboard)/settings/billing/page.tsx` if callback wiring is easier at page level.
- Modify: `apps/dashboard/lib/translations/en.billing.ts`
- Modify: `apps/dashboard/lib/translations/ar.billing.ts`
- Modify: `apps/dashboard/test/unit/components/billing-page.spec.tsx`
- Modify: `apps/dashboard/test/unit/lib/billing-api.spec.ts`

- [ ] Write failing API test that `billingApi.retryPayment()` posts to `/dashboard/billing/subscription/retry-payment`.
- [ ] Add `dunningRetryCount` and `nextRetryAt` to `Subscription`.
- [ ] Add `retryPayment` mutation to `useBillingMutations`.
- [ ] Write failing component tests that:
  - `PAST_DUE` banner includes next retry copy and manual retry button.
  - Clicking manual retry calls the mutation.
  - `PAST_DUE` priority remains above scheduled cancel and limit warning.
- [ ] Implement `BillingStatusBanner` with a retry CTA for `PAST_DUE`.
- [ ] Add AR/EN keys under `billing.banner.dunning.*`.
- [ ] Run dashboard targeted tests.
- [ ] Commit: `feat(dashboard): add dunning recovery banner`.

## Task 9: OpenAPI and Verification

**Files:**
- Modify: `apps/backend/openapi.json`

- [ ] Refresh OpenAPI from this worktree:
  - `DOTENV_CONFIG_PATH=/Users/tariq/code/carekit/apps/backend/.env npm run openapi:build-and-snapshot --workspace=backend`
- [ ] Run backend targeted dunning tests:
  - `cd apps/backend && npx jest --silent src/modules/platform/billing/record-subscription-payment-failure/record-subscription-payment-failure.handler.spec.ts src/modules/platform/billing/dunning-retry/dunning-retry.service.spec.ts src/modules/platform/billing/dunning-retry/dunning-retry.cron.spec.ts src/modules/platform/billing/retry-failed-payment/retry-failed-payment.handler.spec.ts src/api/dashboard/billing.controller.spec.ts --runInBand`
- [ ] Run full backend Jest with OpenAPI pointing at this worktree backend or with the snapshot test skipped intentionally if no backend is running.
- [ ] Run dashboard targeted tests:
  - `cd apps/dashboard && npx vitest run test/unit/components/billing-page.spec.tsx test/unit/lib/billing-api.spec.ts`
- [ ] Run:
  - `npm run typecheck --workspace=backend`
  - `npm run typecheck --workspace=dashboard`
  - `npm run prisma:validate --workspace=backend`
- [ ] Commit: `chore(openapi): refresh snapshot for billing phase 5`.

## Handoff

Before merge, report:

- Commit list.
- Dunning retry policy and any deliberate edge-case decisions.
- Backend Jest result, including full suite count.
- Dashboard test/typecheck result.
- OpenAPI snapshot state.
- Any known baseline failures outside Phase 5 scope.
