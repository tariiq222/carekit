# SaaS-05c — Admin Billing Oversight

> **Path:** DEEP · **Worktree:** required (port band 5110/5120/5130) · **Owner-only:** YES (Abdullah review mandatory) · **Risk:** high (touches money — manual refund/waive/credit)

## 1. Goal

Add a **super-admin oversight layer** on top of the Plan 04 billing domain. Deqah staff get cross-tenant visibility (subscriptions, invoices, MRR/churn) and money-affecting controls (refund, waive, grant credit, force plan change) — every action audited via `SuperAdminActionLog`.

**Plan 04 is intentionally unchanged.** Domain logic (state machine, webhooks, cron, tenant endpoints) stays. This plan adds:

- ~9 admin-facing handlers in `modules/platform/admin/`
- 1 controller in `api/admin/billing.controller.ts`
- 4 admin pages + ~8 vertical-slice features in `apps/admin/`
- 1 small Prisma migration (enum extensions + 2 audit/credit fields)

## 2. Non-goals

- No refactor of tenant-facing billing endpoints (`api/dashboard/billing.controller.ts`)
- No new Moyasar webhook routes — refund triggers an outbound Moyasar API call, then the existing webhook reconciles
- No multi-currency (SAR only, same as Plan 04)
- No revenue recognition / accounting export — that is a future Plan 05d if requested
- No AR (admin panel is English-only per `apps/admin/CLAUDE.md`)

## 3. Architecture

### 3.1 Audience separation (preserve existing rule)

```
api/dashboard/billing.controller.ts  ← Tenant: "my subscription"      (UNTOUCHED)
api/admin/billing.controller.ts      ← Super-admin: "all subscriptions"  (NEW)
api/public/billing-webhook.controller.ts ← Moyasar callback           (UNTOUCHED)
```

Cross-tenant queries on `Subscription` / `SubscriptionInvoice` / `UsageRecord` are safe **only** behind `SuperAdminContextInterceptor` (unlocks `$allTenants`). All admin handlers must be invoked through it.

### 3.2 New handlers (all under `modules/platform/admin/`)

| Handler | Purpose | Audited |
|---|---|---|
| `list-subscriptions` | Cross-tenant list with filters (status, plan, past_due) + pagination | No (read) |
| `get-org-billing` | One org: subscription + last 12 invoices + current-period usage | No (read) |
| `list-subscription-invoices` | Cross-tenant invoice list (filters: status, date range, org) + pagination | No (read) |
| `get-billing-metrics` | MRR, ARR, active count, trialing count, past_due count, churn 30d | No (read) |
| `admin-refund-invoice` | Calls Moyasar refund API, writes `SubscriptionInvoice.refundedAmount`, status → `VOID` if full | **Yes** |
| `admin-waive-invoice` | Sets status → `VOID` without Moyasar call (e.g. waived as goodwill) | **Yes** |
| `admin-grant-credit` | Inserts `BillingCredit` row that next invoice auto-applies | **Yes** |
| `admin-change-plan-for-org` | Forces `Subscription.planId` change immediately (no proration v1) | **Yes** |
| `admin-force-charge-subscription` | Manually re-attempts charge for `PAST_DUE` sub via existing `record-subscription-payment*` path | **Yes** |

Each handler matches the established pattern (see `modules/platform/admin/suspend-organization/suspend-organization.handler.ts`):

```ts
type Cmd = {
  superAdminUserId: string;
  reason: string;        // min 10 chars (validated in DTO)
  ipAddress: string;
  userAgent: string;
  // …handler-specific fields
};
```

The handler runs the mutation + writes the `SuperAdminActionLog` row inside one Prisma `$transaction` so audit can never silently miss.

### 3.3 New controller — `api/admin/billing.controller.ts`

```ts
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/billing')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminBillingController {
  // GET   /admin/billing/subscriptions             → list-subscriptions
  // GET   /admin/billing/subscriptions/:orgId      → get-org-billing
  // GET   /admin/billing/invoices                  → list-subscription-invoices
  // GET   /admin/billing/metrics                   → get-billing-metrics
  // POST  /admin/billing/invoices/:id/refund       → admin-refund-invoice
  // POST  /admin/billing/invoices/:id/waive        → admin-waive-invoice
  // POST  /admin/billing/credits                   → admin-grant-credit
  // PATCH /admin/billing/subscriptions/:orgId/plan → admin-change-plan-for-org
  // POST  /admin/billing/subscriptions/:orgId/charge → admin-force-charge-subscription
}
```

Same guard stack as the other 7 admin controllers — see `verticals.controller.ts` for the canonical example. **Use `@CurrentUser() user: { id: string }`** (not `sub`) and **omit `ParseUUIDPipe`** from `@Param('id')` — keep consistent with the bug-fix commit `bfa697fb` we just landed.

### 3.4 Frontend — `apps/admin/app/(admin)/billing/`

Per `apps/admin/CLAUDE.md` Hard Rule #1, every action is its own slice under `features/billing/<action>/`.

**Pages (≤ 80 lines each, page anatomy law applies):**

```
app/(admin)/billing/
├── page.tsx                          → /billing  (subscriptions list)
├── invoices/page.tsx                 → /billing/invoices  (invoices list)
├── metrics/page.tsx                  → /billing/metrics  (MRR/churn cards + groupBy)
└── [orgId]/page.tsx                  → /billing/<orgId>  (org billing detail)
```

**Vertical slices:**

```
features/billing/
├── types.ts
├── list-subscriptions/
│   ├── list-subscriptions.api.ts
│   ├── use-list-subscriptions.ts
│   └── subscriptions-table.tsx + subscriptions-filter-bar.tsx
├── list-subscription-invoices/
│   ├── list-subscription-invoices.api.ts
│   ├── use-list-subscription-invoices.ts
│   └── invoices-table.tsx + invoices-filter-bar.tsx
├── get-billing-metrics/
│   ├── get-billing-metrics.api.ts
│   ├── use-get-billing-metrics.ts
│   └── billing-metrics-grid.tsx
├── get-org-billing/
│   ├── get-org-billing.api.ts
│   ├── use-get-org-billing.ts
│   └── org-billing-detail.tsx
├── refund-invoice/
│   ├── refund-invoice.api.ts
│   ├── use-refund-invoice.ts
│   └── refund-invoice-dialog.tsx
├── waive-invoice/
│   ├── waive-invoice.api.ts
│   ├── use-waive-invoice.ts
│   └── waive-invoice-dialog.tsx
├── grant-credit/
│   ├── grant-credit.api.ts
│   ├── use-grant-credit.ts
│   └── grant-credit-dialog.tsx
├── change-plan-for-org/
│   ├── change-plan-for-org.api.ts
│   ├── use-change-plan-for-org.ts
│   └── change-plan-dialog.tsx
└── force-charge-subscription/
    ├── force-charge-subscription.api.ts
    ├── use-force-charge-subscription.ts
    └── force-charge-dialog.tsx
```

**Sidebar update:** add `{ href: '/billing', label: 'Billing' }` after `Plans` in `apps/admin/shell/sidebar.tsx`.

### 3.5 Page anatomy compliance

`/billing` (subscriptions list) and `/billing/invoices` follow the dashboard list-page law verbatim:

- Breadcrumbs (Admin > Billing)
- PageHeader: Title + description | [Export outline] [no primary add — read-only list]
- StatsGrid: 4 cards (Active subs · Trialing · Past due · Canceled 30d)
- FilterBar (search by org name/slug · status ▼ · plan ▼ · Reset)
- DataTable (no Card wrapper)
- Pagination (when totalPages > 1)
- Dialogs (refund · waive · change plan · force charge) at bottom

`/billing/metrics` does NOT follow list-page law — it's a metrics dashboard (cards + grouped bar charts). Use existing `metrics-grid.tsx` as a starting point.

`/billing/[orgId]` is a detail page — use the same skeleton as `/organizations/[id]`: header card, then tabbed sections (Subscription · Invoices · Usage · Credits).

## 4. Schema changes (additive — no edits to existing migrations)

**File:** `apps/backend/prisma/schema/platform.prisma`

```prisma
enum SuperAdminActionType {
  // …existing 11 values
  BILLING_REFUND          // NEW
  BILLING_WAIVE_INVOICE   // NEW
  BILLING_GRANT_CREDIT    // NEW
  BILLING_CHANGE_PLAN     // NEW
  BILLING_FORCE_CHARGE    // NEW
}

model SubscriptionInvoice {
  // …existing fields…
  refundedAmount Decimal?  @db.Decimal(12, 2)  // NEW — null = no refund; equals amount = full refund
  refundedAt     DateTime?                      // NEW
  voidedReason   String?                        // NEW — set when waived (status=VOID)
}

model BillingCredit {                           // NEW MODEL — platform table, not tenant-scoped
  id                String    @id @default(uuid())
  organizationId    String    // denormalized; this is Deqah's liability to the tenant
  amount            Decimal   @db.Decimal(12, 2)  // positive credit, deducted from next invoice
  currency          String    @default("SAR")
  reason            String    @db.Text
  grantedByUserId   String    // super-admin who granted
  grantedAt         DateTime  @default(now())
  consumedInvoiceId String?   // set when invoice consumes it
  consumedAt        DateTime?
  createdAt         DateTime  @default(now())

  @@index([organizationId, consumedAt])
  @@index([grantedByUserId])
}
```

**Migration:** `apps/backend/prisma/migrations/<ts>_saas_05c_admin_billing/migration.sql` — pure additive (CREATE TYPE values, ALTER TABLE ADD COLUMN, CREATE TABLE). No data backfill needed.

**Tenant scoping:** `BillingCredit` is **NOT** added to `SCOPED_MODELS` (platform-level, like `Subscription` / `SubscriptionInvoice`). Cross-tenant queries are intended.

**Rollback note (`apps/backend/prisma/NOTES.md`):**
```
05c — admin billing oversight
  Tables added: BillingCredit
  Columns added: SubscriptionInvoice.refundedAmount, refundedAt, voidedReason
  Enum values added: SuperAdminActionType.BILLING_REFUND, BILLING_WAIVE_INVOICE,
                     BILLING_GRANT_CREDIT, BILLING_CHANGE_PLAN, BILLING_FORCE_CHARGE
  Rollback: DROP TABLE BillingCredit;
           ALTER TABLE SubscriptionInvoice DROP COLUMN refundedAmount, refundedAt, voidedReason;
           Postgres enums cannot drop values — leave enum extensions in place.
```

## 5. Reuse + dependencies

**Reused (no edits):**

- `SuperAdminContextInterceptor` (unlocks `$allTenants`)
- `SuperAdminGuard` + `AdminHostGuard` + `JwtGuard`
- `SubscriptionStateMachine` (refund must NOT change status; waive sets `VOID` directly)
- Moyasar HTTP client from `modules/finance/moyasar/` — extend with `refundPayment(paymentId, amount?)` if not present
- `SuperAdminActionLog` write helper (currently inlined in each handler — keep that pattern)
- `metrics-grid.tsx` from `features/platform-metrics` — copy as base for billing-metrics-grid

**Touched (small extensions):**

- `apps/admin/shell/sidebar.tsx` — add Billing entry
- `apps/backend/src/modules/platform/billing/billing.module.ts` — export `SubscriptionStateMachine` so admin handlers can call it
- `apps/backend/src/api/admin/admin.module.ts` (or equivalent) — register `AdminBillingController`

**External:**

- Moyasar refund API: `POST https://api.moyasar.com/v1/payments/{id}/refund` with platform secret key. Idempotent on `payment_id`.

## 6. Security invariants (Abdullah review must verify)

1. **Every admin handler writes `SuperAdminActionLog` in the same `$transaction` as the mutation** — never as a fire-and-forget afterwards.
2. **Refund amount is server-validated** against `SubscriptionInvoice.amount - (refundedAmount ?? 0)` — never trust the request body for max.
3. **Waive cannot resurrect a paid invoice** — guard on current status (only `DUE`, `FAILED` allowed → `VOID`; not `PAID`).
4. **Grant credit minimum amount = 1 SAR, maximum = 100,000 SAR** — sanity bound to catch typos.
5. **Force charge respects retry/grace logic** — calls existing `charge-due-subscriptions` path with `forceOrgId`, never bypasses state machine.
6. **Change plan is immediate, no proration** — clearly labeled in the dialog confirmation; reason mandatory; if downgrade and quota exceeded, dialog warns but does not block (super-admin override).
7. **Moyasar refund failures are surfaced** — no silent swallow. Handler returns structured error and the dialog shows it.

## 7. Path / worktree / commands

- **Path:** DEEP — owner-only + money-affecting + > 30 files.
- **Worktree:** required.
  ```bash
  git worktree add ../deqah-saas-05c -b feat/saas-05c-admin-billing main
  cd ../deqah-saas-05c
  npm install
  ```
- **Ports:** backend 5110, dashboard 5120, admin 5130 (per `WORKTREES.md`). Update local env files only — no commits to env mappings.
- **Migration:**
  ```bash
  cd apps/backend && npm run prisma:migrate -- --name saas_05c_admin_billing
  npx prisma generate
  ```
- **Build/test loop:**
  ```bash
  npm run lint
  npm run typecheck --workspace=backend
  npm run typecheck --workspace=admin
  npm run build --workspace=backend
  npm run build --workspace=admin
  npm run test --workspace=backend
  npm run test:e2e --workspace=backend
  ```
- **Kiwi sync:**
  ```bash
  npm run test:kiwi:all
  npm run kiwi:sync-manual data/kiwi/billing-2026-04-23.json
  ```

## 8. i18n keys

**None** — the admin panel is English-only LTR per `apps/admin/CLAUDE.md`. All strings inline.

For tenant-facing surfaces (none in this plan), the rule from memory applies: future "Vertical" exposure → `"القطاع"`; this plan does not introduce any tenant strings.

## 9. Page Anatomy law applicability

| Page | Applies? |
|---|---|
| `/billing` | ✅ Full law (list page) |
| `/billing/invoices` | ✅ Full law (list page) |
| `/billing/metrics` | ❌ Not a list page — metrics dashboard pattern |
| `/billing/[orgId]` | ❌ Detail page — follows `/organizations/[id]` shape |

## 10. Semantic tokens

All status badges use existing tokens — no hex, no `text-gray-*`:

- `ACTIVE`, `PAID` → `bg-success/10 text-success border-success/30`
- `TRIALING` → `bg-info/10 text-info border-info/30`
- `PAST_DUE`, `FAILED` → `bg-warning/10 text-warning border-warning/30`
- `SUSPENDED`, `CANCELED`, `VOID` → `bg-destructive/10 text-destructive border-destructive/30`
- `DRAFT`, `DUE` → `bg-muted text-muted-foreground`

## 11. File budget check

All new files target ≤ 200 lines. The largest expected:

- `subscriptions-table.tsx` (~180 lines — many columns)
- `org-billing-detail.tsx` (~250 lines — split if > 280 into `org-billing-tabs.tsx`)
- `admin-refund-invoice.handler.ts` (~120 lines)
- `billing.controller.ts` (~150 lines)

Hard cap 350. Split immediately if any file approaches 320.

## 12. Step-by-step execution order

When the implementer (Cursor / Copilot / external AI) picks this up:

1. **Schema first** — write Prisma diff + migration; `prisma migrate dev`; `prisma generate`. Confirm `npm run typecheck` clean.
2. **Audit + read handlers** (no money) in this order, with specs each:
   `list-subscriptions` → `list-subscription-invoices` → `get-billing-metrics` → `get-org-billing`.
3. **Mutating handlers**, easy → hard:
   `admin-grant-credit` → `admin-waive-invoice` → `admin-change-plan-for-org` → `admin-force-charge-subscription` → `admin-refund-invoice`.
4. **Controller** — `api/admin/billing.controller.ts`, register in admin module.
5. **E2E suite** — write all 9 specs (see TEST_CASES.md), run `npm run test:e2e`.
6. **Frontend slices** in slice-per-PR style if possible:
   list-subscriptions + types → list-subscription-invoices → get-billing-metrics → get-org-billing → mutating dialogs (one per slice).
7. **Sidebar entry** + 4 pages.
8. **Manual QA** via Chrome DevTools MCP at `:5130`.
9. **Kiwi sync** — both automated and manual.
10. **OpenAPI snapshot:** `npm run openapi:build-and-snapshot` and commit.

## 13. Risks & rollback

| Risk | Mitigation |
|---|---|
| Moyasar refund partial-failure (charged but Moyasar timeout) | Idempotency key on refund call; reconcile job re-checks `payment_id` status nightly |
| Super-admin grants huge credit by typo | 100k SAR upper bound + reason ≥ 10 chars + audit + dialog confirms amount in words |
| Cross-tenant query leaks via missing interceptor | E2E `admin-billing-isolation.e2e-spec.ts` asserts 403 without `SuperAdminGuard` |
| New columns nullable but not backfilled | Code defaults `refundedAmount ?? 0` everywhere; no NOT NULL constraint |
| Waiving an in-flight Moyasar charge race | State machine forbids `VOID` from `PAID`; admin must refund first |

**Rollback:** the worktree branch can be deleted; the migration is forward-only but additive (safe to leave columns + table empty if reverting).

## 14. Out of scope (filed for future plans)

- **05d** — revenue recognition + accounting CSV export
- **05e** — proration on plan change
- **05f** — bulk credits ("grant 100 SAR to all Salon vertical orgs")
- **05g** — refund partial-line-item granularity
- **05h** — admin self-serve coupon issuance for SaaS subs

---

**Estimated scope:** ~30–35 new files, ~3,500 LOC, 9 backend handlers + 9 E2E specs + 4 admin pages + 9 vertical slices.
**Confidence:** medium-high — the patterns (audit, slice, page anatomy, super-admin guard) are well-established. The novel piece is the Moyasar refund call.
