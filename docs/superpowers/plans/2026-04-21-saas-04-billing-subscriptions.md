# SaaS-04 — Billing & Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## ⚠️ OWNER-REVIEW GATE (read first)

Plan 04 extends the **Moyasar payment gateway** integration for SaaS subscription billing (charging clinic owners on a recurring schedule). This is **distinct** from Plan 02e's booking-payment flow (clinic charging its clients) but shares the same Moyasar SDK adapter. Per root `CLAUDE.md` "Security Sensitivity Tiers", payments and ZATCA are **owner-only** (`@tariq`).

**Before execution of any task in this plan:**

1. Post a plan-ready PR link to the owner and block merge until the owner explicitly approves the PR with `/approve saas-04` in comments.
2. No commit touching `src/modules/finance/moyasar-api/`, `src/modules/platform/billing/`, or the new subscription webhook route may merge without `@tariq` on the reviewer list and an approving review.
3. The state machine (`subscription-state-machine.ts`) requires owner sign-off on the transition diagram BEFORE any handler is implemented. Draft the diagram in Task 3, get approval, then proceed.
4. **No production Moyasar keys** are used in tests. Use `MOYASAR_TEST_MODE=true` and `sk_test_*` keys exclusively.
5. **Subscription invoices are NEW artifacts issued by CareKit** (not by the clinic). They must be kept separate from booking `Invoice` rows. Do not mix ZATCA compliance paths — subscription invoices use CareKit's own VAT registration; booking invoices use the clinic's.

**Scope decision:** `SubscriptionInvoice` is a **separate model from `Invoice`**. Reasoning:
- Audience differs: `Invoice` is clinic → client; `SubscriptionInvoice` is CareKit → clinic.
- ZATCA submission path differs: booking invoices go through each clinic's ZATCA onboarding; subscription invoices go through CareKit's own ZATCA account.
- Lifecycle / PDF format differ.
- Search/filter needs differ.

This is called out for explicit owner confirmation in Task 1.

---

**Goal:** Introduce SaaS subscription billing. Each `Organization` has at most one active `Subscription` linked to a `Plan` (starter / professional / enterprise). Plans carry feature limits (max branches, max employees, max bookings/month, feature flags). A `PlanLimitsGuard` enforces the limits on create-* endpoints. A BullMQ cron meters usage daily and emits `UsageRecord` rows. Dunning flow via Moyasar subscription webhook drives state transitions (TRIALING → ACTIVE → PAST_DUE → SUSPENDED → CANCELED). Dashboard skeleton route `/settings/billing` shows current plan + usage bars (full UI in Plan 06).

**Architecture:** Strangler pattern — all new code is additive. `Plan` and `SubscriptionInvoice` are **platform-level** (not tenant-scoped — they describe CareKit's catalog and CareKit's receivables). `Subscription` and `UsageRecord` are tenant-scoped (belong to an org, scoped via the existing Prisma `$extends` Proxy). A new module `src/modules/platform/billing/` holds all handlers. A second Moyasar webhook endpoint (`POST /api/v1/public/billing/webhooks/moyasar`) handles subscription events — separate route, separate signing secret from Plan 02e's booking webhook. Moyasar does not currently support native recurring subscriptions; we store Moyasar customer + tokenized card references and drive billing cycles via a BullMQ cron (`charge-due-subscriptions.cron.ts`). The webhook handles async payment confirmations and failures.

**Tech Stack:** NestJS 11, Prisma 7, `nestjs-cls` TenantContextService, BullMQ 5, Moyasar HTTP API (via existing `moyasar-api.client.ts`), Jest + Supertest.

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites.** Before injecting `PlanLimitsGuard` into existing create-handlers, grep every controller method to confirm all create paths are covered.
2. **Migrations are immutable.** Append-only.
3. **`$transaction` callback form bypasses the Proxy** (Lesson 11). Any `tx.subscription.*` or `tx.usageRecord.*` inside a callback needs explicit `organizationId`.
4. **Extension covers `where` not `data`** (Lesson 8). Every `prisma.subscription.create({ data: {} })` must include `organizationId` explicitly.
5. **Extension covers reads not writes for scoped models.** `PlanLimitsGuard` calls `prisma.branch.count({ where: {} })` — the extension will inject `organizationId` into the where clause. Verify this works for `count` as well as `findMany`.
6. **`runAs` / CLS callbacks must be `async () => {}`** (Lesson 9). The BullMQ cron will call `tenant.runAs(orgId, async () => {...})` for each org.
7. **3-stage tenant resolution for webhooks** — same pattern used by Plan 02e for booking payments: (a) Moyasar signature verification (no tenant context yet), (b) look up `SubscriptionInvoice` / `Subscription` by `moyasarPaymentId` / `moyasarSubscriptionRef` (platform-level read, no tenant), (c) enter tenant context via `tenant.runAs(subscription.organizationId, async () => ...)` for downstream tenant-scoped writes.
8. **Plan limits are read-your-writes sensitive** — when checking `maxBookingsPerMonth`, we must count bookings created in the current period. Use a single `prisma.booking.count({ where: { createdAt: { gte: periodStart } } })` guarded by the tenant extension.
9. **Divergence-before-commit.** Stop, document, propose, execute after confirmation.

---

## SCOPED_MODELS after this plan

Add `Subscription` and `UsageRecord`. Leave `Plan` and `SubscriptionInvoice` platform-level.

```ts
const SCOPED_MODELS = new Set<string>([
  // ... prior entries ...
  // 04 — billing
  'Subscription', 'UsageRecord',
]);
```

---

## File Structure

### New files

**Schema:**
- Extend `apps/backend/prisma/schema/platform.prisma` with: `Plan`, `SubscriptionInvoice`, `Subscription`, `UsageRecord`, plus enums (`PlanSlug`, `BillingCycle`, `SubscriptionStatus`, `SubscriptionInvoiceStatus`, `UsageMetric`).

**Migrations:**
- `apps/backend/prisma/migrations/<ts>_saas_04_billing_models/migration.sql`
- `apps/backend/prisma/migrations/<ts>_saas_04_seed_plans/migration.sql`

**Backend module `src/modules/platform/billing/`:**
- `billing.module.ts`
- `subscription-state-machine.ts`
- `subscription-state-machine.spec.ts`
- `list-plans/list-plans.handler.ts` + `.spec.ts`
- `get-current-subscription/get-current-subscription.handler.ts` + `.spec.ts`
- `start-subscription/start-subscription.handler.ts` + `.spec.ts` (initial sign-up → TRIALING)
- `upgrade-plan/upgrade-plan.handler.ts` + `.spec.ts`
- `downgrade-plan/downgrade-plan.handler.ts` + `.spec.ts`
- `cancel-subscription/cancel-subscription.handler.ts` + `.spec.ts`
- `resume-subscription/resume-subscription.handler.ts` + `.spec.ts`
- `record-subscription-payment/record-subscription-payment.handler.ts` + `.spec.ts` (internal, called by webhook)
- `record-subscription-payment-failure/record-subscription-payment-failure.handler.ts` + `.spec.ts`
- `meter-usage/meter-usage.cron.ts` + `.spec.ts` (BullMQ Processor / @Cron)
- `charge-due-subscriptions/charge-due-subscriptions.cron.ts` + `.spec.ts`
- `enforce-limits.guard.ts` (`PlanLimitsGuard`) + `.spec.ts`
- `plan-limits.decorator.ts` (`@EnforceLimit('BRANCHES' | 'EMPLOYEES' | 'BOOKINGS_PER_MONTH' | 'STORAGE_MB' | 'NOTIFICATIONS_PER_MONTH')`)
- `subscription-cache.service.ts` (in-memory cache keyed by orgId → Plan limits, invalidated on plan change)
- `subscription-cache.service.spec.ts`
- `dto/start-subscription.dto.ts`
- `dto/change-plan.dto.ts`
- `dto/moyasar-subscription-webhook.dto.ts`

**Webhook handler:**
- `src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler.ts`
- `src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler.spec.ts`
- `src/modules/finance/moyasar-api/moyasar-subscription.client.ts` — thin wrapper calling existing `moyasar-api.client.ts` with subscription-specific helpers (create customer, tokenize card, charge with saved token).

**Controllers:**
- `src/api/dashboard/billing.controller.ts` (tenant-scoped: list plans, current sub, upgrade/downgrade/cancel/resume)
- `src/api/public/billing-webhook.controller.ts` (Moyasar subscription webhook endpoint)

**TenantContextService helper:**
- Extend `src/common/tenant/tenant-context.service.ts` with `currentPlanLimits()` returning cached limits via `SubscriptionCacheService`.

**Dashboard skeleton (full UI in Plan 06):**
- `apps/dashboard/app/(dashboard)/settings/billing/page.tsx`
- `apps/dashboard/app/(dashboard)/settings/billing/components/current-plan-card.tsx`
- `apps/dashboard/app/(dashboard)/settings/billing/components/usage-bars.tsx`
- `apps/dashboard/app/(dashboard)/settings/billing/components/invoices-table.tsx`
- `apps/dashboard/hooks/use-current-subscription.ts`
- `apps/dashboard/lib/api/billing.ts`

**Tests:**
- `apps/backend/test/e2e/billing/subscription-lifecycle.e2e-spec.ts`
- `apps/backend/test/e2e/billing/plan-limits-enforcement.e2e-spec.ts`
- `apps/backend/test/e2e/billing/usage-metering.e2e-spec.ts`
- `apps/backend/test/e2e/billing/moyasar-subscription-webhook.e2e-spec.ts`

**Config / env:**
- Add to `apps/backend/src/config/env.validation.ts`: `MOYASAR_SUBSCRIPTION_WEBHOOK_SECRET`, `SAAS_TRIAL_DAYS`, `BILLING_CRON_ENABLED`.

**Memory:**
- `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas04_status.md`

### Modified files

- `apps/backend/src/infrastructure/database/prisma.service.ts` — add `Subscription`, `UsageRecord` to `SCOPED_MODELS`.
- `apps/backend/src/common/tenant/tenant-context.service.ts` — add `currentPlanLimits()`.
- Existing create handlers — inject `@EnforceLimit(...)` on the corresponding controller methods (5 sites; see Task 10):
  - `src/api/dashboard/org-config.controller.ts` → `createBranch`
  - `src/api/dashboard/people.controller.ts` → `createEmployee`
  - `src/api/dashboard/bookings.controller.ts` → `createBooking` (and public/mobile create paths)
  - `src/api/dashboard/media.controller.ts` → `uploadFile`
  - `src/api/dashboard/comms.controller.ts` → `sendNotification` (and any notification-emitting handler)

### Explicitly out of scope

- Full `/settings/billing` dashboard UI beyond skeleton (Plan 06).
- Super-admin panel showing all subscriptions (Plan 05b).
- Signup wizard payment step (Plan 07).
- Marketing pricing page (Plan 07).
- Moving booking-payment webhook (Plan 02e) — untouched here.

---

## Invariants (must hold at every task boundary)

1. `npm run typecheck` passes.
2. `npm run test` passes.
3. `npm run test:e2e` passes.
4. `BILLING_CRON_ENABLED=false` (default in dev/test) → crons do not run.
5. `TENANT_ENFORCEMENT=permissive` → all new tenant-scoped reads honor the default org.
6. `SAAS_TRIAL_DAYS` default 14.
7. All Moyasar API calls in tests use mock HTTP client — no network egress.
8. Every state transition is logged to `ActivityLog` with `{ organizationId, subscriptionId, fromStatus, toStatus, triggeredBy }`.

---

## Task 1 — Owner-review gate + scope confirmation

- [ ] **Step 1.1: Post scope-decision note in PR**

Create branch `feat/saas-04-billing-subscriptions` and push an empty commit:

```bash
git checkout -b feat/saas-04-billing-subscriptions
git commit --allow-empty -m "chore(saas-04): open owner-review branch"
git push -u origin feat/saas-04-billing-subscriptions
gh pr create --draft --title "feat(saas-04): billing & subscriptions (DRAFT — owner review)" \
  --body "$(cat <<'EOF'
⚠️ OWNER-REVIEW REQUIRED

Scope decisions awaiting @tariq sign-off:
1. SubscriptionInvoice is a **separate model** from Invoice (booking-client vs CareKit-clinic audiences; separate ZATCA paths).
2. Moyasar native recurring subscriptions not used — cron-driven charge cycle via saved card tokens. Confirm OK.
3. PlanLimitsGuard applied to: create-branch, create-employee, create-booking, upload-file, send-notification. Confirm the list.
4. State machine (see Task 3 diagram) — transitions need approval before implementation.
5. Webhook secret env var `MOYASAR_SUBSCRIPTION_WEBHOOK_SECRET` distinct from booking webhook.

NO code touching finance/moyasar-api/ or platform/billing/ will merge without explicit /approve comment.
EOF
)"
```

- [ ] **Step 1.2: Wait for `/approve saas-04` comment**

Do NOT proceed to Task 2 until owner posts `/approve saas-04` in the PR.

---

## Task 2 — Env + config

- [ ] **Step 2.1: Extend env validation**

`apps/backend/src/config/env.validation.ts`:

```ts
// Billing (SaaS-04)
MOYASAR_SUBSCRIPTION_WEBHOOK_SECRET: Joi.string().min(16).required(),
SAAS_TRIAL_DAYS: Joi.number().integer().min(0).max(90).default(14),
BILLING_CRON_ENABLED: Joi.boolean().default(false),
```

- [ ] **Step 2.2: Update `.env.example`**

```
# Billing (SaaS-04)
MOYASAR_SUBSCRIPTION_WEBHOOK_SECRET=change-me-in-production
SAAS_TRIAL_DAYS=14
BILLING_CRON_ENABLED=false
```

- [ ] **Step 2.3: Typecheck + commit**

```bash
cd apps/backend && npm run typecheck
git add apps/backend/src/config/env.validation.ts apps/backend/.env.example
git commit -m "chore(saas-04): add billing env vars"
```

---

## Task 3 — Subscription state machine (design + tests first)

- [ ] **Step 3.1: Diagram the state machine**

States: `TRIALING`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELED`.

Allowed transitions:

```
             ┌───────────┐
  (start) →  │ TRIALING  │
             └─────┬─────┘
                   │ first successful charge / trial-end charge success
                   ▼
             ┌───────────┐                         ┌───────────┐
             │  ACTIVE   │ ──── cancel ─────────→  │ CANCELED  │
             └──┬─────┬──┘                         └───────────┘
                │     │ charge failure
                │     ▼
                │  ┌───────────┐  retries exhausted   ┌───────────┐
                │  │ PAST_DUE  │ ──────────────────→  │ SUSPENDED │
                │  └────┬──────┘                      └─────┬─────┘
                │       │ payment recovers                  │
                │       ▼                                   │ resume + charge success
                │    ACTIVE ←───────────────────────────────┘
                │
                └── downgrade/upgrade (self-loop, sub-step)
```

Post this diagram + the transition table below in the PR as a comment. **Block on owner approval before Step 3.2.**

Transition table (source of truth):

| From | Event | To | Preconditions |
|---|---|---|---|
| — | `startSubscription` | TRIALING | plan exists, org has no active sub |
| TRIALING | `chargeSuccess` | ACTIVE | Moyasar payment confirmed |
| TRIALING | `trialExpired + chargeFailure` | PAST_DUE | retry counter < max |
| TRIALING | `cancel` | CANCELED | — |
| ACTIVE | `chargeFailure` | PAST_DUE | retry counter < max |
| ACTIVE | `cancel` | CANCELED | — |
| ACTIVE | `upgrade/downgrade` | ACTIVE | new plan valid; prorated invoice issued |
| PAST_DUE | `chargeSuccess` | ACTIVE | — |
| PAST_DUE | `retriesExhausted` | SUSPENDED | retry count >= max (default 3) |
| PAST_DUE | `cancel` | CANCELED | — |
| SUSPENDED | `resume + chargeSuccess` | ACTIVE | owner-initiated resume |
| SUSPENDED | `cancel` | CANCELED | — |
| CANCELED | — | — | terminal |

- [ ] **Step 3.2: TDD — state-machine spec first**

`subscription-state-machine.spec.ts`:

```ts
import { SubscriptionStateMachine, SubscriptionEvent } from './subscription-state-machine';

describe('SubscriptionStateMachine', () => {
  const sm = new SubscriptionStateMachine();

  it('transitions TRIALING → ACTIVE on chargeSuccess', () => {
    expect(sm.transition('TRIALING', { type: 'chargeSuccess' })).toBe('ACTIVE');
  });

  it('transitions ACTIVE → PAST_DUE on chargeFailure', () => {
    expect(sm.transition('ACTIVE', { type: 'chargeFailure' })).toBe('PAST_DUE');
  });

  it('transitions PAST_DUE → ACTIVE on chargeSuccess', () => {
    expect(sm.transition('PAST_DUE', { type: 'chargeSuccess' })).toBe('ACTIVE');
  });

  it('transitions PAST_DUE → SUSPENDED when retryCount >= max', () => {
    expect(sm.transition('PAST_DUE', { type: 'retriesExhausted' })).toBe('SUSPENDED');
  });

  it('transitions SUSPENDED → ACTIVE on resume + chargeSuccess', () => {
    expect(sm.transition('SUSPENDED', { type: 'resumeSuccess' })).toBe('ACTIVE');
  });

  it('CANCELED is terminal — any event throws', () => {
    expect(() => sm.transition('CANCELED', { type: 'chargeSuccess' })).toThrow();
  });

  it('rejects illegal transition ACTIVE → TRIALING', () => {
    expect(() => sm.transition('ACTIVE', { type: 'startSubscription' } as unknown as SubscriptionEvent)).toThrow();
  });
});
```

- [ ] **Step 3.3: Implement**

`subscription-state-machine.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

export type SubscriptionEvent =
  | { type: 'chargeSuccess' }
  | { type: 'chargeFailure' }
  | { type: 'retriesExhausted' }
  | { type: 'resumeSuccess' }
  | { type: 'cancel' }
  | { type: 'upgrade' }
  | { type: 'downgrade' }
  | { type: 'trialExpired' };

type TransitionMap = Record<SubscriptionStatus, Partial<Record<SubscriptionEvent['type'], SubscriptionStatus>>>;

const TRANSITIONS: TransitionMap = {
  TRIALING: { chargeSuccess: 'ACTIVE', chargeFailure: 'PAST_DUE', trialExpired: 'PAST_DUE', cancel: 'CANCELED' },
  ACTIVE: { chargeFailure: 'PAST_DUE', cancel: 'CANCELED', upgrade: 'ACTIVE', downgrade: 'ACTIVE' },
  PAST_DUE: { chargeSuccess: 'ACTIVE', retriesExhausted: 'SUSPENDED', cancel: 'CANCELED' },
  SUSPENDED: { resumeSuccess: 'ACTIVE', cancel: 'CANCELED' },
  CANCELED: {},
};

@Injectable()
export class SubscriptionStateMachine {
  transition(from: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
    const next = TRANSITIONS[from]?.[event.type];
    if (!next) throw new Error(`Illegal transition from ${from} on ${event.type}`);
    return next;
  }

  canTransition(from: SubscriptionStatus, eventType: SubscriptionEvent['type']): boolean {
    return !!TRANSITIONS[from]?.[eventType];
  }
}
```

Run tests — expect pass.

- [ ] **Step 3.4: Commit**

```bash
git add apps/backend/src/modules/platform/billing/subscription-state-machine.ts \
        apps/backend/src/modules/platform/billing/subscription-state-machine.spec.ts
git commit -m "feat(saas-04): subscription state machine + transition table"
```

---

## Task 4 — Schema + migration

- [ ] **Step 4.1: Extend `platform.prisma`**

Append to `apps/backend/prisma/schema/platform.prisma`:

```prisma
// ─── Billing (SaaS-04) ───────────────────────────────────────────────────────
// Plan, SubscriptionInvoice = platform-level (CareKit's catalog / receivables).
// Subscription, UsageRecord = tenant-scoped (belong to an org).

enum PlanSlug {
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum BillingCycle {
  MONTHLY
  ANNUAL
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELED
}

enum SubscriptionInvoiceStatus {
  DRAFT
  DUE
  PAID
  FAILED
  VOID
}

enum UsageMetric {
  BOOKINGS
  EMPLOYEES
  BRANCHES
  STORAGE_MB
  NOTIFICATIONS_SENT
}

model Plan {
  id                 String       @id @default(uuid())
  slug               PlanSlug     @unique
  nameAr             String
  nameEn             String
  priceMonthly       Decimal      @db.Decimal(12, 2)
  priceAnnual        Decimal      @db.Decimal(12, 2)
  currency           String       @default("SAR")
  moyasarProductId   String?      // optional future Moyasar native subscriptions
  limits             Json         // { maxBranches, maxEmployees, maxBookingsPerMonth, maxStorageMB, maxNotificationsPerMonth, websiteEnabled, customDomainEnabled, chatbotEnabled, zatcaEnabled, ratingsEnabled }
  isActive           Boolean      @default(true)
  sortOrder          Int          @default(0)
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  subscriptions      Subscription[]

  @@index([isActive, sortOrder])
}

model Subscription {
  id                   String             @id @default(uuid())
  organizationId       String             @unique    // one active sub per org (SaaS-04 scoped)
  planId               String
  plan                 Plan               @relation(fields: [planId], references: [id], onDelete: Restrict)
  status               SubscriptionStatus @default(TRIALING)
  billingCycle         BillingCycle       @default(MONTHLY)
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  trialEndsAt          DateTime?
  canceledAt           DateTime?
  cancelReason         String?
  retryCount           Int                @default(0)
  maxRetries           Int                @default(3)
  moyasarCustomerRef   String?            // Moyasar customer id
  moyasarCardTokenRef  String?            // tokenized saved card
  moyasarSubscriptionRef String?          // reserved for future native recurring
  lastPaymentAt        DateTime?
  lastFailureReason    String?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  invoices             SubscriptionInvoice[]
  usageRecords         UsageRecord[]

  @@index([organizationId])
  @@index([planId])
  @@index([status])
  @@index([currentPeriodEnd])
}

model SubscriptionInvoice {
  id                 String                    @id @default(uuid())
  subscriptionId     String
  subscription       Subscription              @relation(fields: [subscriptionId], references: [id], onDelete: Restrict)
  organizationId     String                    // denormalized for analytics; NOT a SCOPED_MODEL — this is CareKit's receivable
  amount             Decimal                   @db.Decimal(12, 2)
  currency           String                    @default("SAR")
  status             SubscriptionInvoiceStatus @default(DRAFT)
  billingCycle       BillingCycle
  periodStart        DateTime
  periodEnd          DateTime
  dueDate            DateTime
  issuedAt           DateTime?
  paidAt             DateTime?
  moyasarPaymentId   String?                   @unique
  failureReason      String?
  attemptCount       Int                       @default(0)
  receiptUrl         String?
  pdfUrl             String?
  createdAt          DateTime                  @default(now())
  updatedAt          DateTime                  @updatedAt

  @@index([subscriptionId])
  @@index([organizationId])
  @@index([status])
  @@index([dueDate])
}

model UsageRecord {
  id             String      @id @default(uuid())
  organizationId String      // SaaS-04 scoped
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  metric         UsageMetric
  count          Int
  periodStart    DateTime
  periodEnd      DateTime
  createdAt      DateTime    @default(now())

  @@unique([subscriptionId, metric, periodStart])
  @@index([organizationId])
  @@index([subscriptionId])
  @@index([metric])
}
```

- [ ] **Step 4.2: Validate schema**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

- [ ] **Step 4.3: Generate migration**

```bash
cd apps/backend && npx prisma migrate dev --name saas_04_billing_models --create-only
```

Inspect SQL; if generation fails due to pgvector, write manually using the prior patterns.

- [ ] **Step 4.4: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 4.5: Seed plans**

Create migration `<ts>_saas_04_seed_plans/migration.sql`:

```sql
INSERT INTO "Plan" (id, slug, "nameAr", "nameEn", "priceMonthly", "priceAnnual", currency, limits, "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-00000000p001', 'STARTER',      'الباقة الأساسية',    'Starter',      99,    999,   'SAR',
    '{"maxBranches":1,"maxEmployees":5,"maxBookingsPerMonth":200,"maxStorageMB":1024,"maxNotificationsPerMonth":500,"websiteEnabled":false,"customDomainEnabled":false,"chatbotEnabled":false,"zatcaEnabled":true,"ratingsEnabled":true}',
    true, 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-00000000p002', 'PROFESSIONAL', 'الباقة الاحترافية',  'Professional', 299,   2999,  'SAR',
    '{"maxBranches":5,"maxEmployees":25,"maxBookingsPerMonth":2000,"maxStorageMB":10240,"maxNotificationsPerMonth":5000,"websiteEnabled":true,"customDomainEnabled":false,"chatbotEnabled":true,"zatcaEnabled":true,"ratingsEnabled":true}',
    true, 20, NOW(), NOW()),
  ('00000000-0000-0000-0000-00000000p003', 'ENTERPRISE',   'الباقة المؤسسية',   'Enterprise',   899,   8999,  'SAR',
    '{"maxBranches":-1,"maxEmployees":-1,"maxBookingsPerMonth":-1,"maxStorageMB":-1,"maxNotificationsPerMonth":-1,"websiteEnabled":true,"customDomainEnabled":true,"chatbotEnabled":true,"zatcaEnabled":true,"ratingsEnabled":true}',
    true, 30, NOW(), NOW());
```

(`-1` = unlimited, handled in guard.)

- [ ] **Step 4.6: Apply and commit**

```bash
cd apps/backend && npx prisma migrate deploy
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations/
git commit -m "feat(saas-04): billing models + seed STARTER/PROFESSIONAL/ENTERPRISE"
```

---

## Task 5 — SCOPED_MODELS update

- [ ] **Step 5.1: Add `Subscription`, `UsageRecord`**

Edit `apps/backend/src/infrastructure/database/prisma.service.ts`:

```ts
// 04 — billing
'Subscription', 'UsageRecord',
```

`Plan` and `SubscriptionInvoice` are deliberately **not** added — they are platform-level.

- [ ] **Step 5.2: Typecheck + commit**

```bash
cd apps/backend && npm run typecheck
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-04): scope Subscription + UsageRecord"
```

---

## Task 6 — `SubscriptionCacheService` + `TenantContextService.currentPlanLimits()`

- [ ] **Step 6.1: TDD cache service**

`subscription-cache.service.spec.ts` — write tests for:
- Cache miss → fetch from DB → cache hit.
- `invalidate(orgId)` clears entry.
- TTL enforced (use injected clock).

- [ ] **Step 6.2: Implement**

```ts
// subscription-cache.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CachedPlanLimits {
  planSlug: string;
  status: string;
  limits: Record<string, number | boolean>;
  expiresAt: number;
}

@Injectable()
export class SubscriptionCacheService {
  private readonly cache = new Map<string, CachedPlanLimits>();
  private readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string): Promise<CachedPlanLimits | null> {
    const hit = this.cache.get(organizationId);
    if (hit && hit.expiresAt > Date.now()) return hit;

    // Platform-level read — use prisma.$queryRaw or direct find (Plan and Subscription are unscoped reads here; Subscription read is intentionally org-filtered).
    const sub = await this.prisma.subscription.findFirst({
      where: { organizationId },
      include: { plan: true },
    });
    if (!sub) return null;

    const entry: CachedPlanLimits = {
      planSlug: sub.plan.slug,
      status: sub.status,
      limits: sub.plan.limits as Record<string, number | boolean>,
      expiresAt: Date.now() + this.TTL_MS,
    };
    this.cache.set(organizationId, entry);
    return entry;
  }

  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }
}
```

- [ ] **Step 6.3: Extend `TenantContextService`**

Add method `async currentPlanLimits(): Promise<CachedPlanLimits | null>` that calls `SubscriptionCacheService.get(this.requireOrganizationIdOrDefault())`.

- [ ] **Step 6.4: Commit**

```bash
git add apps/backend/src/modules/platform/billing/subscription-cache.service.ts \
        apps/backend/src/modules/platform/billing/subscription-cache.service.spec.ts \
        apps/backend/src/common/tenant/tenant-context.service.ts
git commit -m "feat(saas-04): subscription cache + TenantContext.currentPlanLimits"
```

---

## Task 7 — Core handlers

For each handler: DTO → failing spec → implement → pass → commit. Full shape shown for `start-subscription`; others follow same pattern.

### 7A — `start-subscription.handler.ts`

- [ ] **Step 7A.1: DTO**

```ts
// dto/start-subscription.dto.ts
import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';
import { BillingCycle } from '@prisma/client';

export class StartSubscriptionDto {
  @IsUUID() planId!: string;
  @IsEnum(BillingCycle) billingCycle!: BillingCycle;
  @IsOptional() @IsString() moyasarCardTokenRef?: string;
}
```

- [ ] **Step 7A.2: TDD spec**

Tests:
- Throws `ConflictException` if org already has a subscription.
- Creates subscription with `status=TRIALING`, `trialEndsAt = now + SAAS_TRIAL_DAYS`.
- Sets `currentPeriodStart/End` for monthly billing.
- Emits `SubscriptionStartedEvent`.
- Logs to `ActivityLog`.

- [ ] **Step 7A.3: Implement**

```ts
// start-subscription.handler.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs'; // or existing event emitter
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { StartSubscriptionDto } from '../dto/start-subscription.dto';

@Injectable()
export class StartSubscriptionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: StartSubscriptionDto) {
    const organizationId = this.tenant.requireOrganizationId();

    const existing = await this.prisma.subscription.findFirst({ where: { organizationId } });
    if (existing) throw new ConflictException('Organization already has a subscription');

    const plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found');

    const trialDays = this.config.get<number>('SAAS_TRIAL_DAYS', 14);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 86_400_000);
    const periodEnd =
      dto.billingCycle === 'ANNUAL'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const sub = await this.prisma.subscription.create({
      data: {
        organizationId,                // required — Lesson 8
        planId: plan.id,
        status: 'TRIALING',
        billingCycle: dto.billingCycle,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        moyasarCardTokenRef: dto.moyasarCardTokenRef,
      },
    });

    this.cache.invalidate(organizationId);
    // TODO: emit SubscriptionStartedEvent + ActivityLog.
    return sub;
  }
}
```

- [ ] **Step 7A.4: Commit**

```bash
git add apps/backend/src/modules/platform/billing/start-subscription/ \
        apps/backend/src/modules/platform/billing/dto/start-subscription.dto.ts
git commit -m "feat(saas-04): StartSubscriptionHandler (TRIALING entry point)"
```

### 7B — `list-plans.handler.ts`

Read-only: `prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })`. No tenant context needed. Commit.

### 7C — `get-current-subscription.handler.ts`

`findFirst({ where: { organizationId }, include: { plan: true, invoices: true } })`. Scoped by extension. Commit.

### 7D — `upgrade-plan.handler.ts` / `downgrade-plan.handler.ts`

- Fetch current subscription.
- Load target plan, validate transition (upgrade = higher price; downgrade = lower price; reject no-op).
- Compute proration for remainder of current period; create `SubscriptionInvoice` with `DRAFT` for the diff (or credit).
- Update subscription.planId.
- Fire state machine event `upgrade` or `downgrade` (both stay in `ACTIVE`).
- Invalidate cache.
- Commit each.

### 7E — `cancel-subscription.handler.ts`

- State machine event `cancel`.
- Set `canceledAt = now`, `cancelReason = dto.reason`, `status = CANCELED`.
- Do NOT delete row — keep for history.
- Emit `SubscriptionCanceledEvent`.
- Commit.

### 7F — `resume-subscription.handler.ts`

- Only from `SUSPENDED`. Retry charge via Moyasar client; on success → `ACTIVE`; else throw.
- Commit.

### 7G — `record-subscription-payment.handler.ts` / `record-subscription-payment-failure.handler.ts`

Internal — invoked by the webhook. Input: `{ moyasarPaymentId, subscriptionId, amount, status }`. Updates `SubscriptionInvoice` + `Subscription` state via state machine. Increments `retryCount` on failure. These handlers do NOT require tenant context (webhook resolves it via `tenant.runAs`). Commit each.

---

## Task 8 — `PlanLimitsGuard` + `@EnforceLimit()` decorator

- [ ] **Step 8.1: TDD guard spec**

Tests for each metric:
- `BRANCHES`: allows when `count < maxBranches`; throws `ForbiddenException` at `count >= maxBranches`; `-1` means unlimited.
- `EMPLOYEES`: same pattern via `prisma.employee.count()`.
- `BOOKINGS_PER_MONTH`: counts bookings with `createdAt >= currentPeriodStart`.
- `STORAGE_MB`: sums `prisma.file.aggregate({ _sum: { sizeBytes } })` / (1024*1024).
- `NOTIFICATIONS_PER_MONTH`: counts notifications since period start.
- When subscription status is `SUSPENDED` or `CANCELED`: always deny (regardless of limit).

- [ ] **Step 8.2: Decorator**

```ts
// plan-limits.decorator.ts
import { SetMetadata } from '@nestjs/common';

export type LimitKind = 'BRANCHES' | 'EMPLOYEES' | 'BOOKINGS_PER_MONTH' | 'STORAGE_MB' | 'NOTIFICATIONS_PER_MONTH';
export const ENFORCE_LIMIT_KEY = 'plan-limits:enforce';
export const EnforceLimit = (kind: LimitKind) => SetMetadata(ENFORCE_LIMIT_KEY, kind);
```

- [ ] **Step 8.3: Guard implementation**

```ts
// enforce-limits.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../common/tenant';
import { SubscriptionCacheService } from './subscription-cache.service';
import { ENFORCE_LIMIT_KEY, LimitKind } from './plan-limits.decorator';

@Injectable()
export class PlanLimitsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.get<LimitKind>(ENFORCE_LIMIT_KEY, ctx.getHandler());
    if (!kind) return true;

    const organizationId = this.tenant.requireOrganizationId();
    const cached = await this.cache.get(organizationId);
    if (!cached) throw new ForbiddenException('No active subscription');
    if (cached.status === 'CANCELED' || cached.status === 'SUSPENDED') {
      throw new ForbiddenException(`Subscription is ${cached.status}`);
    }

    const limit = this.resolveLimit(kind, cached.limits);
    if (limit === -1) return true; // unlimited

    const current = await this.currentUsage(kind, organizationId);
    if (current >= limit) {
      throw new ForbiddenException(`Plan limit reached for ${kind}: ${current}/${limit}`);
    }
    return true;
  }

  private resolveLimit(kind: LimitKind, limits: Record<string, number | boolean>): number {
    switch (kind) {
      case 'BRANCHES': return Number(limits.maxBranches ?? 0);
      case 'EMPLOYEES': return Number(limits.maxEmployees ?? 0);
      case 'BOOKINGS_PER_MONTH': return Number(limits.maxBookingsPerMonth ?? 0);
      case 'STORAGE_MB': return Number(limits.maxStorageMB ?? 0);
      case 'NOTIFICATIONS_PER_MONTH': return Number(limits.maxNotificationsPerMonth ?? 0);
    }
  }

  private async currentUsage(kind: LimitKind, organizationId: string): Promise<number> {
    // Extension auto-injects organizationId for scoped models. We keep the predicate explicit for auditability.
    switch (kind) {
      case 'BRANCHES':
        return this.prisma.branch.count({ where: { organizationId, isActive: true } });
      case 'EMPLOYEES':
        return this.prisma.employee.count({ where: { organizationId } });
      case 'BOOKINGS_PER_MONTH': {
        const sub = await this.prisma.subscription.findFirst({ where: { organizationId } });
        if (!sub) return Number.POSITIVE_INFINITY;
        return this.prisma.booking.count({ where: { organizationId, createdAt: { gte: sub.currentPeriodStart } } });
      }
      case 'STORAGE_MB': {
        const agg = await this.prisma.file.aggregate({ where: { organizationId }, _sum: { sizeBytes: true } });
        return Math.ceil(Number(agg._sum.sizeBytes ?? 0) / (1024 * 1024));
      }
      case 'NOTIFICATIONS_PER_MONTH': {
        const sub = await this.prisma.subscription.findFirst({ where: { organizationId } });
        if (!sub) return Number.POSITIVE_INFINITY;
        return this.prisma.notification.count({ where: { organizationId, createdAt: { gte: sub.currentPeriodStart } } });
      }
    }
  }
}
```

- [ ] **Step 8.4: Commit**

```bash
git add apps/backend/src/modules/platform/billing/enforce-limits.guard.ts \
        apps/backend/src/modules/platform/billing/enforce-limits.guard.spec.ts \
        apps/backend/src/modules/platform/billing/plan-limits.decorator.ts
git commit -m "feat(saas-04): PlanLimitsGuard + @EnforceLimit decorator"
```

---

## Task 9 — BullMQ crons

### 9A — `meter-usage.cron.ts`

Runs daily at 02:00 Asia/Riyadh. For each active subscription:
- Compute counts for each metric over the current period.
- `prisma.usageRecord.upsert({ where: { subscriptionId_metric_periodStart: {...} }, update: { count }, create: { organizationId, subscriptionId, metric, count, periodStart, periodEnd } })`.
- Emit `UsageWarningEvent` if any metric crosses 80% / 100% of plan limit.
- Uses `tenant.runAs(sub.organizationId, async () => {...})` per Lesson 9.
- Guarded by `BILLING_CRON_ENABLED`.

- [ ] **Step 9A.1: TDD + implement.**

### 9B — `charge-due-subscriptions.cron.ts`

Runs hourly. Finds subscriptions where `currentPeriodEnd <= now()` and `status IN ('TRIALING','ACTIVE','PAST_DUE')`. For each:
- Create `SubscriptionInvoice` with status=DUE.
- Call `MoyasarSubscriptionClient.chargeWithToken(sub.moyasarCardTokenRef, amount, idempotencyKey=invoice.id)`.
- On success → `recordSubscriptionPaymentHandler.execute({...})`.
- On failure → `recordSubscriptionPaymentFailureHandler.execute({...})`.
- Advance `currentPeriodStart/End` only on success.

- [ ] **Step 9B.1: TDD + implement.**

### 9C — Commit each

```bash
git add apps/backend/src/modules/platform/billing/meter-usage/
git commit -m "feat(saas-04): meter-usage cron + UsageRecord upserts"
git add apps/backend/src/modules/platform/billing/charge-due-subscriptions/
git commit -m "feat(saas-04): charge-due-subscriptions cron + Moyasar charge flow"
```

---

## Task 10 — Wire `PlanLimitsGuard` into existing create endpoints

- [ ] **Step 10.1: Grep audit**

```bash
grep -rn "createBranch\|CreateBranchHandler\|createEmployee\|CreateEmployeeHandler\|createBooking\|CreateBookingHandler\|uploadFile\|sendNotification" apps/backend/src/api/ --include="*.ts"
```

Document every matching controller method.

- [ ] **Step 10.2: Register `PlanLimitsGuard` globally**

Add to the existing global guard stack in `app.module.ts` (or wherever `JwtGuard`/`CaslGuard` are configured) AFTER those guards. Global registration means every route evaluates the decorator; routes without `@EnforceLimit()` short-circuit and allow.

- [ ] **Step 10.3: Annotate endpoints**

```ts
// src/api/dashboard/org-config.controller.ts — createBranch
@Post('branches')
@EnforceLimit('BRANCHES')
createBranch(@Body() dto: CreateBranchDto) { ... }

// src/api/dashboard/people.controller.ts — createEmployee
@Post('employees')
@EnforceLimit('EMPLOYEES')
createEmployee(...) { ... }

// src/api/dashboard/bookings.controller.ts + mobile + public — createBooking
@Post('bookings')
@EnforceLimit('BOOKINGS_PER_MONTH')
createBooking(...) { ... }

// src/api/dashboard/media.controller.ts — upload
@Post('files')
@EnforceLimit('STORAGE_MB')
uploadFile(...) { ... }

// src/api/dashboard/comms.controller.ts — send notification
@Post('notifications/send')
@EnforceLimit('NOTIFICATIONS_PER_MONTH')
sendNotification(...) { ... }
```

- [ ] **Step 10.4: Run unit tests**

Tests for each annotated endpoint should still pass — guards short-circuit on test module setup with `{ provide: PlanLimitsGuard, useValue: { canActivate: () => true } }` or the existing testing utility.

- [ ] **Step 10.5: Commit**

```bash
git add apps/backend/src/app.module.ts apps/backend/src/api/
git commit -m "feat(saas-04): enforce plan limits on 5 create-* endpoints"
```

---

## Task 11 — Moyasar subscription webhook

- [ ] **Step 11.1: Client wrapper**

`src/modules/finance/moyasar-api/moyasar-subscription.client.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { MoyasarApiClient } from './moyasar-api.client';

@Injectable()
export class MoyasarSubscriptionClient {
  constructor(private readonly moyasar: MoyasarApiClient) {}

  async chargeWithToken(params: {
    token: string;
    amount: number;         // minor units
    currency: string;
    idempotencyKey: string;
    description: string;
    callbackUrl: string;
  }) {
    return this.moyasar.post('/payments', {
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      source: { type: 'token', token: params.token },
      callback_url: params.callbackUrl,
    }, { idempotencyKey: params.idempotencyKey });
  }

  verifySignature(rawBody: string, signature: string, secret: string): boolean {
    // Reuse signature check from booking webhook with the subscription secret.
    return this.moyasar.verifyHmac(rawBody, signature, secret);
  }
}
```

- [ ] **Step 11.2: Webhook handler (3-stage tenant resolution)**

```ts
// moyasar-subscription-webhook.handler.ts
@Injectable()
export class MoyasarSubscriptionWebhookHandler {
  constructor(
    private readonly client: MoyasarSubscriptionClient,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly recordPayment: RecordSubscriptionPaymentHandler,
    private readonly recordFailure: RecordSubscriptionPaymentFailureHandler,
    private readonly config: ConfigService,
  ) {}

  async execute(raw: Buffer, signature: string): Promise<{ ok: true }> {
    // Stage 1: verify signature (no tenant context)
    const secret = this.config.getOrThrow<string>('MOYASAR_SUBSCRIPTION_WEBHOOK_SECRET');
    if (!this.client.verifySignature(raw.toString('utf8'), signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = JSON.parse(raw.toString('utf8')) as MoyasarSubscriptionWebhookDto;

    // Stage 2: look up invoice by Moyasar payment id (platform-level read)
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { moyasarPaymentId: event.data.id },
      include: { subscription: true },
    });
    if (!invoice) {
      // Unknown payment — log and swallow; do NOT 500.
      return { ok: true };
    }

    // Stage 3: enter tenant context for scoped writes
    await this.tenant.runAs(invoice.subscription.organizationId, async () => {
      if (event.type === 'payment_paid') {
        await this.recordPayment.execute({ invoiceId: invoice.id, moyasarPaymentId: event.data.id });
      } else if (event.type === 'payment_failed') {
        await this.recordFailure.execute({
          invoiceId: invoice.id,
          moyasarPaymentId: event.data.id,
          reason: event.data.source?.message ?? 'unknown',
        });
      }
    });

    return { ok: true };
  }
}
```

- [ ] **Step 11.3: Controller**

`src/api/public/billing-webhook.controller.ts`:

```ts
@ApiTags('Public / Billing')
@Controller('public/billing/webhooks/moyasar')
export class BillingWebhookController {
  constructor(private readonly handler: MoyasarSubscriptionWebhookHandler) {}

  @Post()
  @ApiOperation({ summary: 'Moyasar subscription payment webhook' })
  @HttpCode(200)
  handle(@Req() req: RawBodyRequest<Request>, @Headers('x-moyasar-signature') sig: string) {
    return this.handler.execute(req.rawBody!, sig);
  }
}
```

Ensure `rawBody: true` in `main.ts` bootstrap — already set for Plan 02e's booking webhook; verify before editing.

- [ ] **Step 11.4: Spec + commit**

```bash
git add apps/backend/src/modules/finance/moyasar-api/moyasar-subscription.client.ts \
        apps/backend/src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler.ts \
        apps/backend/src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler.spec.ts \
        apps/backend/src/api/public/billing-webhook.controller.ts
git commit -m "feat(saas-04): Moyasar subscription webhook (3-stage tenant resolution)"
```

---

## Task 12 — Module + controller wiring

- [ ] **Step 12.1: `billing.module.ts`**

Register all handlers, guards, crons, client. Import `DatabaseModule`, `TenantModule`, `MoyasarApiModule`, `BullModule.registerQueue({ name: 'billing' })`. Export handlers needed by controllers.

- [ ] **Step 12.2: Dashboard controller**

`src/api/dashboard/billing.controller.ts`:

```ts
@ApiTags('Dashboard / Billing')
@Controller('dashboard/billing')
@UseGuards(JwtGuard, CaslGuard)
export class BillingController {
  constructor(
    private readonly list: ListPlansHandler,
    private readonly current: GetCurrentSubscriptionHandler,
    private readonly start: StartSubscriptionHandler,
    private readonly upgrade: UpgradePlanHandler,
    private readonly downgrade: DowngradePlanHandler,
    private readonly cancel: CancelSubscriptionHandler,
    private readonly resume: ResumeSubscriptionHandler,
  ) {}

  @Get('plans') plans() { return this.list.execute(); }
  @Get('subscription') subscription() { return this.current.execute(); }
  @Post('subscription/start') startSub(@Body() dto: StartSubscriptionDto) { return this.start.execute(dto); }
  @Post('subscription/upgrade') up(@Body() dto: ChangePlanDto) { return this.upgrade.execute(dto); }
  @Post('subscription/downgrade') down(@Body() dto: ChangePlanDto) { return this.downgrade.execute(dto); }
  @Post('subscription/cancel') cancelSub(@Body() dto: { reason?: string }) { return this.cancel.execute(dto); }
  @Post('subscription/resume') resumeSub() { return this.resume.execute({}); }
}
```

- [ ] **Step 12.3: Regenerate OpenAPI and commit**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
git add apps/backend/src/modules/platform/billing/billing.module.ts \
        apps/backend/src/api/dashboard/billing.controller.ts \
        apps/backend/src/app.module.ts \
        apps/backend/openapi.json
git commit -m "feat(saas-04): billing module + dashboard controller"
```

---

## Task 13 — Dashboard skeleton

Ship a minimal, functional UI — full polish in Plan 06.

- [ ] **Step 13.1: API client + hook**

`apps/dashboard/lib/api/billing.ts`:

```ts
export const billingApi = {
  listPlans: () => api.get('/dashboard/billing/plans'),
  currentSubscription: () => api.get('/dashboard/billing/subscription'),
  upgrade: (planId: string) => api.post('/dashboard/billing/subscription/upgrade', { planId }),
  downgrade: (planId: string) => api.post('/dashboard/billing/subscription/downgrade', { planId }),
  cancel: (reason?: string) => api.post('/dashboard/billing/subscription/cancel', { reason }),
  resume: () => api.post('/dashboard/billing/subscription/resume', {}),
};
```

`apps/dashboard/hooks/use-current-subscription.ts`: wraps `useQuery` around `billingApi.currentSubscription`.

- [ ] **Step 13.2: Page + components**

- `settings/billing/page.tsx` — Page anatomy per root CLAUDE.md: breadcrumbs, PageHeader ("الفوترة والاشتراك" / "Billing & Subscription"), no stats grid (billing page is config, not a list), three cards: `<CurrentPlanCard />`, `<UsageBars />`, `<InvoicesTable />`.
- `current-plan-card.tsx` — shows plan name, status badge, next billing date, upgrade/downgrade/cancel buttons.
- `usage-bars.tsx` — reads subscription → plan.limits + UsageRecord counts; renders 5 progress bars.
- `invoices-table.tsx` — lists `SubscriptionInvoice` rows, paid/due/failed chips.

- [ ] **Step 13.3: Commit**

```bash
git add apps/dashboard/app/\(dashboard\)/settings/billing/ \
        apps/dashboard/hooks/use-current-subscription.ts \
        apps/dashboard/lib/api/billing.ts
git commit -m "feat(saas-04): dashboard billing skeleton (full UI in plan 06)"
```

---

## Task 14 — e2e tests

### 14A — `subscription-lifecycle.e2e-spec.ts`

Full walk: seed org → start subscription (TRIALING) → webhook payment_paid (ACTIVE) → webhook payment_failed (PAST_DUE) → webhook payment_failed × 3 (SUSPENDED) → resume + success (ACTIVE) → cancel (CANCELED). Assert final state + `ActivityLog` entries.

### 14B — `plan-limits-enforcement.e2e-spec.ts`

- Seed org with STARTER plan (maxBranches=1). Create 1 branch succeeds; 2nd returns 403.
- Seed org with ENTERPRISE (unlimited). Create 20 branches all succeed.
- Seed org with status=SUSPENDED. Any create returns 403.

### 14C — `usage-metering.e2e-spec.ts`

- Seed 2 orgs with different plans.
- Create bookings/employees/branches under each.
- Run `meterUsageCron.runOnce()` synchronously.
- Assert `UsageRecord` rows exist per metric per org, scoped correctly (no cross-tenant reads).

### 14D — `moyasar-subscription-webhook.e2e-spec.ts`

- POST webhook with invalid signature → 401.
- POST webhook with valid signature, unknown payment id → 200, noop.
- POST `payment_paid` → SubscriptionInvoice → PAID, Subscription → ACTIVE.
- POST `payment_failed` → retryCount++, state transition.

- [ ] **Step 14.5: Run**

```bash
cd apps/backend && npm run test:e2e -- billing
```

- [ ] **Step 14.6: Commit**

```bash
git add apps/backend/test/e2e/billing/
git commit -m "test(saas-04): subscription lifecycle + limits + usage + webhook e2e"
```

---

## Task 15 — Final verification

- [ ] **Step 15.1: Full unit + e2e + typecheck**

```bash
cd apps/backend && npm run test && npm run test:e2e && npm run typecheck
cd apps/dashboard && npm run typecheck && npm run test
```

- [ ] **Step 15.2: Manual smoke (optional but recommended)**

Start backend, POST through the dashboard flow: list plans → start sub → simulate webhook via httpie using test signature → confirm state transitions in Prisma Studio.

- [ ] **Step 15.3: Memory**

`memory/saas04_status.md`:

```
---
name: SaaS-04 status
description: Plan 04 (billing & subscriptions) — status
type: project
---
**Status:** Delivered <date> in PR #<n>. Owner-review gate cleared <date>.

**Deliverables:** Plan, Subscription, SubscriptionInvoice, UsageRecord models; state machine; PlanLimitsGuard applied to 5 create-paths; meter-usage + charge-due-subscriptions crons; Moyasar subscription webhook (3-stage tenant resolution); dashboard billing skeleton.

**SCOPED_MODELS additions:** Subscription, UsageRecord.

**Scope decisions confirmed by owner:**
- SubscriptionInvoice separate from Invoice (different audience/ZATCA path).
- Moyasar cron-driven recurring (not native subscriptions).

**Next:** Plan 05b (super-admin UI) consumes Subscription + UsageRecord. Plan 06 fully styles the billing page. Plan 07 integrates StartSubscriptionHandler into signup wizard.
```

- [ ] **Step 15.4: Mark PR ready for review**

```bash
gh pr ready
```

Require `@tariq` review before merge.

---

## Amendments applied during execution

> Empty until execution. Record any divergence (especially around Moyasar behavior or state-machine edge cases) here.
