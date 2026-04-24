# TEST CASES — SaaS-05c Admin Billing Oversight

**Kiwi TCMS Product:** CareKit (id=1)
**Version:** main
**Build:** `saas-05c-billing-2026-04-23`

---

## Plan: `CareKit / Billing / Unit`

Colocated `*.handler.spec.ts` next to each handler under `apps/backend/src/modules/platform/admin/`.

### list-subscriptions.handler.spec.ts
- ✓ returns paginated list across multiple orgs when `$allTenants` is set (CLS bypass)
- ✓ filters by `status=PAST_DUE`
- ✓ filters by `planId`
- ✓ orders by `currentPeriodEnd` desc
- ✓ throws `UnauthorizedTenantAccessError` if invoked without `SuperAdminContextInterceptor` (defense in depth)

### get-org-billing.handler.spec.ts
- ✓ returns subscription + last 12 invoices + current-period usage rows for given orgId
- ✓ returns `null` subscription if org has none (org may be pre-billing)
- ✓ throws `OrganizationNotFoundError` if orgId unknown

### list-subscription-invoices.handler.spec.ts
- ✓ paginates across orgs
- ✓ filters by `status`, `dateRange`, `organizationId`
- ✓ excludes `DRAFT` by default; includeDrafts=true returns them

### get-billing-metrics.handler.spec.ts
- ✓ MRR = Σ(Plan.priceMonthly for ACTIVE + TRIALING subs)
- ✓ ARR = MRR × 12
- ✓ counts active / trialing / past_due / suspended / canceled correctly
- ✓ churn 30d = canceled in last 30d / active 30d ago

### admin-grant-credit.handler.spec.ts
- ✓ writes BillingCredit + SuperAdminActionLog inside one $transaction
- ✓ DTO rejects amount < 1 SAR
- ✓ DTO rejects amount > 100,000 SAR
- ✓ DTO rejects reason < 10 chars
- ✓ stores `grantedByUserId` from Cmd.superAdminUserId
- ✓ throws `OrganizationNotFoundError` if orgId unknown

### admin-waive-invoice.handler.spec.ts
- ✓ DUE → VOID, voidedReason set, audit row written
- ✓ FAILED → VOID
- ✓ PAID → throws `InvoiceCannotBeWaivedError` (must refund instead)
- ✓ already VOID → throws (no-op forbidden to keep audit clean)
- ✓ DRAFT → throws

### admin-change-plan-for-org.handler.spec.ts
- ✓ Subscription.planId updated, audit written
- ✓ targeting an inactive Plan throws
- ✓ same plan throws (no-op)
- ✓ no proration applied (currentPeriodEnd untouched)

### admin-force-charge-subscription.handler.spec.ts
- ✓ ACTIVE sub throws (only PAST_DUE / TRIALING with overdue invoice eligible)
- ✓ PAST_DUE sub triggers existing charge handler with forceOrgId
- ✓ audit row references the resulting payment attempt
- ✓ Moyasar success → state machine moves PAST_DUE → ACTIVE (covered by integration test downstream)

### admin-refund-invoice.handler.spec.ts
- ✓ full refund: refundedAmount = amount, status → VOID, audit written
- ✓ partial refund: refundedAmount = partial, status stays PAID, audit written
- ✓ refund > remaining throws `RefundExceedsAmountError`
- ✓ refunding unpaid invoice throws
- ✓ Moyasar 4xx surfaces as structured error, no DB mutation
- ✓ Moyasar timeout → idempotency key allows safe retry
- ✓ second refund with same idempotency key returns prior result

---

## Plan: `CareKit / Billing / E2E`

Under `apps/backend/test/e2e/admin/billing/`. Use `superAdminAgent` from existing helpers.

### admin-billing-isolation.e2e-spec.ts (security gate)
- ✓ all 9 routes return 403 without JWT
- ✓ all 9 routes return 403 with non-super-admin JWT (CASL covered by SuperAdminGuard)
- ✓ all 9 routes return 403 with impersonation JWT (scope=impersonation)
- ✓ AdminHostGuard rejects requests from non-admin host

### list-subscriptions.e2e-spec.ts
- ✓ returns subs from ≥ 2 seeded orgs
- ✓ filter by status narrows results
- ✓ pagination links correct

### list-invoices.e2e-spec.ts
- ✓ cross-tenant invoice list works
- ✓ date range filter excludes out-of-range rows

### get-org-billing.e2e-spec.ts
- ✓ super-admin can read another org's full billing context
- ✓ tenant JWT cannot reach this route (covered in isolation spec)

### get-billing-metrics.e2e-spec.ts
- ✓ MRR matches sum of seeded ACTIVE plan prices
- ✓ counts match seeded fixtures

### refund-invoice.e2e-spec.ts
- ✓ Moyasar refund mock 200 → invoice updated, audit row visible at /admin/audit-log
- ✓ Moyasar refund mock 4xx → 502 returned, no DB mutation
- ✓ second call with same body is idempotent (no double-refund)

### waive-invoice.e2e-spec.ts
- ✓ DUE → VOID with reason ≥ 10 chars
- ✓ PAID → 400 with explicit error message

### grant-credit.e2e-spec.ts
- ✓ credit row created
- ✓ next-invoice cron applies it (chained or stubbed)
- ✓ grants over 100k → 400

### change-plan-for-org.e2e-spec.ts
- ✓ plan changed, audit visible
- ✓ inactive plan target → 400

### force-charge-subscription.e2e-spec.ts
- ✓ PAST_DUE org charges via existing handler path
- ✓ ACTIVE org → 400

---

## Plan: `CareKit / Billing / Manual QA`

QA agent walks through Chrome DevTools MCP at `http://localhost:5130` (worktree admin port) signed in as super-admin.

| # | Step | Expected |
|---|---|---|
| 1 | Click sidebar "Billing" | `/billing` loads, StatsGrid shows 4 cards, Subscriptions table shows ≥ 2 orgs |
| 2 | Filter status = PAST_DUE | Table narrows to past-due subs only |
| 3 | Click an org row | `/billing/<orgId>` loads with 4 tabs (Subscription · Invoices · Usage · Credits) |
| 4 | On Invoices tab, click Refund on a PAID invoice | Dialog opens; submit disabled when reason < 10 chars |
| 5 | Submit refund with reason "Customer requested cancellation" | Row updates: status VOID, refundedAmount = amount; toast success |
| 6 | Click Waive on a DUE invoice | Dialog opens; submit with reason → row VOID, voidedReason set |
| 7 | Click "Grant credit" → 50 SAR + reason | Credits tab shows new row |
| 8 | Click "Change plan" → BASIC → PRO + reason | Subscription tab shows new plan; warning shown about no-proration |
| 9 | Force-charge a PAST_DUE sub | Backend job triggers; status flips to ACTIVE after webhook reconcile (visible on refresh) |
| 10 | Visit `/billing/metrics` | MRR card matches seeded value; group-by-plan bar chart renders |
| 11 | Visit `/audit-log` | Filter actionType `BILLING_*` → all 5 actions from steps 5-9 visible with reasons |
| 12 | Open dev console | No 401/403/500 errors during the entire walk-through |

**Deliverables after QA:**
- Report at `docs/superpowers/qa/billing-admin-2026-04-23.md` with screenshots per step
- Plan JSON at `data/kiwi/billing-2026-04-23.json` synced via `npm run kiwi:sync-manual data/kiwi/billing-2026-04-23.json`
- Kiwi run URL pasted into the report
