# Tenant Billing Suite — Design Spec

**Date:** 2026-04-30
**Owner:** @tariq
**Status:** Draft (awaiting review)
**Scope:** Professional, complete tenant-facing billing UI + backend gaps for `apps/dashboard`, with matching `apps/admin` updates.

## 1. Goal & Context

Today, `apps/backend/src/modules/platform/billing/` and `apps/dashboard/app/(dashboard)/settings/billing/` already ship a working baseline (≈60% of the surface area). What's missing is what makes a SaaS billing experience feel professional: cancel-at-period-end, multi-card saved-cards, smart-retry dunning, proration, PDF invoices, hard-limit UX, and a properly designed 14-day trial lifecycle.

The goal is to deliver a billing suite that feels like Stripe/Linear in quality, while staying inside Deqah's design system (frosted glass, RTL-first, IBM Plex Sans Arabic, semantic tokens, Page Anatomy Law).

### Non-goals
- SMS billing (per-tenant providers; Deqah does not bill SMS — confirmed in `saas_sms_architecture.md`).
- Bookings overage / credits / top-up (bookings are unlimited on every plan).
- Bank-transfer payment method (everything via Moyasar cards).
- Mobile billing UI (mobile is single-tenant per build; billing is a clinic-owner concern, not an end-user one).

## 2. Decisions Locked In

| Area | Decision |
|---|---|
| Trial | 14 days, no card required at signup, full chosen plan unlocked, auto-convert at day 14, super-admin can extend |
| Cancellation | Cancel-at-period-end (Stripe model). Trial cancel is immediate (no period to wait). |
| Plan change | Hybrid proration — upgrade is immediate with prorated charge; downgrade is scheduled to next period boundary |
| Saved cards | Multi-card with one default. Last card with active subscription cannot be deleted |
| Dunning | Smart retry: t+0, t+3h, t+1d, t+3d, t+7d (4 retries over 7 days), then SUSPENDED |
| Bookings | Unlimited on every plan; no overage charges |
| Employees | Hard limit per plan; tenant must self-upgrade (no per-seat overage) |
| Warning UX | Progress bars + in-app notification + light dashboard banner at 80%; blocking dialog at 100% |
| Invoices | Full history page + per-invoice detail page + on-demand PDF (ZATCA-compliant) |

## 3. Architecture

### 3.1 Approach
Polish + Complete on top of the existing baseline. No rewrite. The existing `enforce-limits.guard`, `subscription-state-machine`, `subscription-cache.service`, `usage-aggregator.service`, and dashboard components stay; we extend them.

### 3.2 Routes (`apps/dashboard`)

```
/settings/billing                    Overview (existing — enhanced)
/settings/billing/plans              Plan comparison & switching (new)
/settings/billing/payment-methods    Saved-card management (new)
/settings/billing/invoices           Full invoice history (new)
/settings/billing/invoices/[id]      Invoice detail + PDF (new)
/settings/billing/usage              Detailed usage breakdown (new)
```

Every page follows the Page Anatomy Law (Breadcrumbs → PageHeader → ErrorBanner → StatsGrid → FilterBar → DataTable → Pagination → Dialogs).

### 3.3 Backend module additions

```
modules/platform/billing/
├── schedule-cancel-subscription/    Cancel-at-period-end (replaces immediate cancel for non-trial)
├── reactivate-subscription/         Undo a scheduled cancellation
├── compute-proration/               Prorated upgrade charge calculator
├── schedule-downgrade/              Defer downgrade to next period
├── cancel-scheduled-downgrade/      Undo scheduled downgrade
├── saved-cards/{list,add,set-default,remove}/
├── retry-failed-payment/            Manual retry (consumes the dunning budget)
├── generate-invoice-pdf/            On-demand PDF, cached in MinIO
├── send-limit-warning/              80% / 100% notifications
└── extend-trial/                    Super-admin only
```

Cron updates:
- `expire-trials.cron.ts` — extend to fire at day 7, 11, 13, and 14 (charge or suspend).
- `process-scheduled-cancellations.cron.ts` (new, daily).
- `process-scheduled-plan-changes.cron.ts` (new, daily).
- `dunning-retry.cron.ts` (new, hourly).
- `usage-warnings.cron.ts` (new, daily — 80% threshold).

### 3.4 Schema changes (single migration)

```sql
-- Subscription: trial + cancel + scheduled changes + dunning state
ALTER TABLE "Subscription"
  ADD COLUMN "trialStartedAt"             TIMESTAMP(3),
  ADD COLUMN "trialEndsAt"                TIMESTAMP(3),
  ADD COLUMN "trialExtendedBy"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trialExtendedById"          TEXT,
  ADD COLUMN "trialExtendedAt"            TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledCancellationDate"  TIMESTAMP(3),
  ADD COLUMN "scheduledPlanId"            TEXT,
  ADD COLUMN "scheduledBillingCycle"      TEXT,
  ADD COLUMN "scheduledPlanChangeAt"      TIMESTAMP(3),
  ADD COLUMN "dunningRetryCount"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt"                TIMESTAMP(3),
  ADD COLUMN "warnedAt80Percent"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultSavedCardId"         TEXT;

-- SavedCard
CREATE TABLE "SavedCard" (
  id              TEXT PRIMARY KEY,
  organizationId  TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  moyasarTokenId  TEXT NOT NULL UNIQUE,
  last4           TEXT NOT NULL,
  brand           TEXT NOT NULL,
  expiryMonth     INTEGER NOT NULL,
  expiryYear      INTEGER NOT NULL,
  holderName      TEXT,
  isDefault       BOOLEAN NOT NULL DEFAULT false,
  createdAt       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       TIMESTAMP(3) NOT NULL
);
CREATE INDEX ON "SavedCard"(organizationId);
CREATE UNIQUE INDEX ON "SavedCard"(organizationId) WHERE isDefault = true;
ALTER TABLE "SavedCard" ENABLE ROW LEVEL SECURITY;
CREATE POLICY savedcard_tenant_isolation ON "SavedCard"
  USING (organizationId = current_setting('app.organization_id', true));

-- DunningLog
CREATE TABLE "DunningLog" (
  id               TEXT PRIMARY KEY,
  organizationId   TEXT NOT NULL,
  subscriptionId   TEXT NOT NULL REFERENCES "Subscription"(id) ON DELETE CASCADE,
  invoiceId        TEXT NOT NULL REFERENCES "SubscriptionInvoice"(id) ON DELETE CASCADE,
  attemptNumber    INTEGER NOT NULL,
  status           TEXT NOT NULL,
  moyasarPaymentId TEXT,
  failureReason    TEXT,
  scheduledFor     TIMESTAMP(3) NOT NULL,
  executedAt       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ON "DunningLog"(organizationId);
CREATE INDEX ON "DunningLog"(subscriptionId);
ALTER TABLE "DunningLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY dunninglog_tenant_isolation ON "DunningLog"
  USING (organizationId = current_setting('app.organization_id', true));

-- SubscriptionInvoice
ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN "pdfStorageKey"  TEXT,
  ADD COLUMN "lastRetryAt"    TIMESTAMP(3),
  ADD COLUMN "retryAttempts"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "savedCardId"    TEXT REFERENCES "SavedCard"(id) ON DELETE SET NULL;
```

`SCOPED_MODELS` (in `prisma.service.ts`) gains: `SavedCard`, `DunningLog`.

### 3.5 State machine (updated)

```
TRIALING ──[day 14, has card, charge ok]──▶ ACTIVE
TRIALING ──[day 14, has card, charge fail]─▶ PAST_DUE  (enters dunning)
TRIALING ──[day 14, no card]───────────────▶ SUSPENDED
TRIALING ──[manual cancel]─────────────────▶ CANCELED
TRIALING ──[super-admin extend]────────────▶ TRIALING (new trialEndsAt)

ACTIVE   ──[chargeFail]─────────────────────▶ PAST_DUE
PAST_DUE ──[retry success]──────────────────▶ ACTIVE (resets retryCount, nextRetryAt)
PAST_DUE ──[4 retries failed]───────────────▶ SUSPENDED

ACTIVE + cancelAtPeriodEnd=true ──[cron at currentPeriodEnd]──▶ CANCELED
ACTIVE + cancelAtPeriodEnd=true ──[reactivate]────────────────▶ ACTIVE (flag cleared)

SUSPENDED ──[card added + charge ok]────────▶ ACTIVE (new period starts)
CANCELED  ─────────────────────────────────── terminal (must re-subscribe)
```

`SCHEDULED_CANCEL` is intentionally not a separate status — it's `status=ACTIVE + cancelAtPeriodEnd=true`. This matches Stripe and avoids a forking state machine.

## 4. Trial Lifecycle (14 days)

```
Day 0   Tenant registers, picks a plan, no card requested.
        Subscription created with status=TRIALING, trialEndsAt=+14d.
        Email: welcome + trial active.

Day 7   expire-trials.cron fires sendTrialDay7Reminder.
        Banner stays calm/blue.

Day 11  Banner turns yellow ("3 days left").
        sendTrialDay3Warning email + in-app notification.

Day 13  Banner turns red ("final day").
        sendTrialDay1Final email + in-app notification.

Day 14  expire-trials.cron acts:
        • Has saved card → charge → ACTIVE on success, PAST_DUE on fail.
        • No saved card → SUSPENDED + sendTrialSuspendedNoCard.
```

Edge cases:
- Adding a card mid-trial does **not** charge early — charge happens at trialEndsAt.
- Switching plans during trial keeps trialEndsAt fixed; the day-14 charge uses the new plan price.
- Cancel during trial = immediate `CANCELED` (no period to wait).
- Super-admin extends → `trialEndsAt += days`, `notifiedTrialEndingAt = NULL` (reminders re-arm), `SuperAdminActionLog` records who/why.

## 5. UX Detail by Page

### 5.1 `/settings/billing` (overview)
- Banners (priority order): Dunning → ScheduledCancel → LimitWarning → Trial.
- StatsGrid: current plan, days until renewal, employees X/Y, next invoice.
- CurrentPlanCard with upgrade/cancel buttons (state-aware: shows "Reactivate" if scheduled-cancel).
- UsageBars (employees only — bookings is unlimited).
- RecentInvoicesPreview (last 3) + link to full list.
- QuickActions row (3 glass tiles).

### 5.2 `/settings/billing/plans`
- Monthly/annual toggle.
- 3-column PlanComparisonGrid with "Current" / "Recommended" badges.
- FeatureMatrix table for full comparison.
- PlanChangeDialog calls `compute-proration` → shows "Pay X SAR now" or "Scheduled for {date}".

### 5.3 `/settings/billing/payment-methods`
- Empty state with primary CTA.
- List of cards as glass tiles with brand icon, masked PAN, expiry, [Default] badge, ⋯ menu.
- AddCardDialog uses Moyasar.js tokenization (3DS-enabled). Verifies via $0.50 SAR auth + immediate refund.
- Delete blocked when it's the last card and there's an active subscription (HTTP 422).

### 5.4 `/settings/billing/invoices`
- StatsGrid (year-to-date paid, pending count, average, last payment date).
- FilterBar (search by number, status filter, date range, reset).
- DataTable: number / date / plan / amount / status / actions ([view][download-pdf]).
- Pagination.

### 5.5 `/settings/billing/invoices/[id]`
- InvoiceHeader with status badge, dates, total.
- From/To cards (Deqah + ZATCA VAT vs. Organization + VAT).
- LineItems table (incl. proration line if applicable).
- PaymentSummary (subtotal, VAT 15%, total).
- PaymentInfo block (card brand + last4, Moyasar reference, paid-at).

### 5.6 `/settings/billing/usage`
- StatsGrid + employees progress + active-employee list.
- UpcomingChargesCard with state-aware copy (cancel scheduled / plan change scheduled / normal renewal).

## 6. API surface

### 6.1 Tenant-facing (`/dashboard/billing/*`)
```
POST   /subscription/schedule-cancel               { reason? }
POST   /subscription/reactivate
GET    /subscription/proration-preview             ?planId&billingCycle
POST   /subscription/upgrade                       { planId, paymentMethodId, billingCycle }
POST   /subscription/schedule-downgrade            { planId, billingCycle }
POST   /subscription/cancel-scheduled-downgrade
POST   /subscription/retry-payment                 (manual; consumes dunning budget)
GET    /saved-cards
POST   /saved-cards                                { moyasarToken, makeDefault? }
PATCH  /saved-cards/:id/set-default
DELETE /saved-cards/:id
GET    /invoices                                   (paginated, filters)
GET    /invoices/:id
GET    /invoices/:id/pdf                           (stream from MinIO)
GET    /usage
```

### 6.2 Super-admin (`/admin/billing/*`)
```
POST   /:orgId/extend-trial                        { days, reason }
POST   /:orgId/force-charge
POST   /:orgId/cancel-scheduled-cancellation
GET    /:orgId/saved-cards                         (read-only)
GET    /:orgId/dunning-history
```

All super-admin handlers gated by `SuperAdminGuard` and write to `SuperAdminActionLog`.

### 6.3 Validation
Zod schemas live in each slice's `dto/` folder. See section 4.3 of the design discussion for shapes.

## 7. Resend templates (additions)

```
trial-day-7-reminder
trial-day-3-warning
trial-day-1-final
trial-converted-to-paid
trial-suspended-no-card
trial-extended
limit-warning-80
limit-reached-100
dunning-retry            (parameterized by attempt number)
scheduled-cancellation-confirm
```

Each is bilingual (AR + EN) using `bilingualLayout()` from `templates/shared.ts`. `PlatformMailerService` gains a method per template.

## 8. `apps/admin` updates

- `/admin/billing` — add columns: dunning state, scheduled-cancel flag/date. Row actions: force-charge, cancel-scheduled-cancellation.
- `/admin/organizations/[id]` — new BillingHealthCard (subscription, saved-cards summary, dunning state, scheduled changes, trial extensions). New "Extend trial" button.
- `/admin/plans` — on save, dialog: "X subscribers will be affected".

## 9. Testing strategy

### 9.1 Backend (Jest)
- One spec per new handler (≈10 specs).
- State-machine spec extended for cancelAtPeriodEnd, scheduled changes, trial transitions.
- E2E: `billing-phase-2.e2e-spec.ts`, `billing-phase-2-isolation.e2e-spec.ts`, `billing-dunning.e2e-spec.ts`, `billing-saved-cards.e2e-spec.ts`.
- Coverage target: ≥85% line coverage on new billing files.

### 9.2 Frontend (Vitest)
- Component tests for each new dialog/banner/page.
- AR/EN parity test (`i18n.spec.ts`).

### 9.3 Manual QA (Chrome DevTools MCP)
- Required pre-merge for every UI-touching phase.
- Report at `docs/superpowers/qa/billing-phase-2-report-<date>.md`.
- Kiwi sync via `data/kiwi/billing-phase-2-<date>.json` and `npm run kiwi:sync-manual`.

### 9.4 Edge cases (must cover)
Proration: day-1, day-29, double upgrade, downgrade-then-undo, downgrade-then-upgrade.
Cancel: cancel-then-reactivate, cancel-with-scheduled-downgrade, cancel-then-upgrade, trial-cancel.
Dunning: card deleted mid-retry, card added mid-retry (resets), manual retry while nextRetryAt is future, 3DS fail in retry.
Saved cards: token expired, expiry-month passed, 3DS fail at add, last-card-with-active-sub delete blocked, default card deletion auto-promotes.
Limits: employee #N+1 login still allowed, deactivating an employee opens a slot, plan upgrade dismisses the dialog.
Tenant isolation: cross-tenant SavedCard access blocked; webhook with no JWT resolves tenant via moyasarPaymentId.

## 10. Performance

- PDFs are generated lazily on first request, cached in MinIO, streamed thereafter.
- Daily usage aggregation runs as a BullMQ batch job (one job per tenant), not a single hot loop.
- `SubscriptionCacheService` is extended to cache saved-cards (TTL 5 min). Invalidated on add/remove/set-default.
- Proration preview is computed live (no cache; rare endpoint).

## 11. Rollout — 10 phases over ~4 weeks

```
Phase 1  Trial lifecycle              ─ schema + cron + emails + TrialBanner
Phase 2  Saved cards (multi-card)     ─ SavedCard model + UI
Phase 3  Cancel-at-period-end         ─ schedule + reactivate
Phase 4  Proration + plan comparison  ─ compute-proration + /plans page
Phase 5  Smart-retry dunning          ─ DunningLog + cron + DunningBanner
Phase 6  Hard limits + warnings       ─ guard update + 80% banner + 100% dialog
Phase 7  Invoices + PDF               ─ /invoices pages + ZATCA PDF
Phase 8  Usage page + overview polish ─ /usage + StatsGrid + states
Phase 9  Admin panel updates          ─ BillingHealthCard + force-charge
Phase 10 E2E + manual QA + Kiwi       ─ full pre-prod gate
```

Each phase is a standalone PR (≤16 files, ≤900 lines), green CI + manual QA before merge. No orphan branches. Phases 3 and 6 can run in parallel with the critical path 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Moyasar tokenization changes break add-card | Pin Moyasar SDK version; test against sandbox in CI |
| PDF generation memory pressure under load | BullMQ queue + per-worker concurrency cap; cache in MinIO so repeat requests stream |
| Proration math errors visible to tenants | Pure-function calculator with an exhaustive unit-test table (12+ cases) |
| Dunning loop runs against deleted card | `dunning-retry.cron` re-resolves the default card on every attempt |
| Trial extension abused | Super-admin only + SuperAdminActionLog audit + reason required |
| Tenant isolation regression on new tables | RLS policies + isolation e2e tests required for SavedCard and DunningLog |

## 13. Open questions
None at spec-write time. Any new questions surfacing during implementation should be raised before coding rather than papered over.
