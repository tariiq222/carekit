# P1.4 — Tenant Bypass Audit (2026-05-09)

## Summary

| Category | Total | ✅ Safe | ⚠️ Suspicious |
|---|---|---|---|
| `$transaction(async tx)` without `applyInTransaction` | 8 | 5 | 3 |
| `systemContext` / `SYSTEM_CONTEXT_CLS_KEY` setter sites | 12 | 9 | 3 |
| `$allTenants` access sites (non-spec) | ~110 | ~105 | 4 |
| `runWithoutTenant` usages | 1 | 1 (definition only) | 0 |
| `requireOrganizationIdOrDefault` usages | ~95 | ~95 | 0 |

---

## Top 5 to Fix First

1. **`perform-password-reset.handler.ts:48`** — `$transaction` on scoped tables (`User`, `PasswordResetToken`, `RefreshToken`) with no `applyInTransaction` and no explicit `organizationId` filter. Any user can reset any user's password if they own the token — but RLS is not enforced inside the tx, meaning a DB-level cross-tenant write is not blocked by policy.

2. **`employee-onboarding.handler.ts:38`** — `$transaction` on scoped tables (`Employee`, `EmployeeBranch`, `EmployeeService`) with no `applyInTransaction`. The tx reads `employee.organizationId` from a pre-tx fetch — that pre-tx fetch itself has no `organizationId` WHERE clause, so a token holder could onboard any employeeId.

3. **`set-client-active.handler.ts:41`** — `$transaction` on `Client` + `ClientRefreshToken` with no `applyInTransaction` and no `organizationId` in the `where`. Pre-tx `findFirst` uses only `{ id, deletedAt }` — no tenant scope. A tenant A actor with knowledge of tenant B's clientId could deactivate it.

4. **`request-dashboard-otp.handler.ts:53`** + **`request-otp.handler.ts:91`** — OTP creation/invalidation transactions with no `organizationId` column on `OtpCode` and no `applyInTransaction`. `OtpCode` has `organizationId` in the WHERE for `request-otp` (line 94) but `request-dashboard-otp` does NOT — it matches only on `identifier` + `purpose`. This is the correct design for dashboard OTP (cross-org user), but it means RLS is intentionally absent; should be explicitly documented.

5. **`moyasar-subscription-webhook.handler.ts:109–116`** — Uses `SYSTEM_CONTEXT_CLS_KEY` (raw systemContext) to do an unscoped `subscriptionInvoice.findFirst` lookup, then immediately re-enters with `TENANT_CLS_KEY + SUPER_ADMIN_CONTEXT_CLS_KEY`. The Stage 3 systemContext window reads `subscriptionInvoice` without `organizationId` filter — correct for the use case but the raw `SYSTEM_CONTEXT_CLS_KEY` path (vs. `$allTenants` under `SUPER_ADMIN_CONTEXT_CLS_KEY`) bypasses the guard in `prisma.service.ts:249`. The `$allTenants` gate requires `SUPER_ADMIN_CONTEXT_CLS_KEY`, but `SYSTEM_CONTEXT_CLS_KEY` is a weaker, undocumented bypass path checked separately at `tenant-scoping.extension.ts:78`.

---

## ⚠️ Suspicious Paths

### 1. `perform-password-reset.handler.ts:48`

- **Path:** `POST /auth/password-reset/perform` (public — no auth required)
- **Bypass type:** `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `User` (scoped), `PasswordResetToken` (scoped), `RefreshToken` (scoped)
- **Why suspicious:** No `applyInTransaction(tx)` call. No `organizationId` in any of the three `where` clauses inside the tx — only `{ id: record.userId }` and `{ id: record.id }`. RLS is not applied to tx client. The pre-tx lookup (`passwordResetToken.findFirst`) also uses `{ tokenSelector, tokenHash }` with no `organizationId` filter.
- **Risk level:** Medium-High. Exploitation requires obtaining a valid reset token belonging to another tenant's user (the token itself is a strong secret), but the DB-layer isolation is absent.
- **Recommended action:** Add `await this.rls.applyInTransaction(tx)` as first line of the tx callback. Add `organizationId` to the pre-tx `findFirst` lookup (requires the token to carry `organizationId`, or look it up via a super-admin context before the tx).

---

### 2. `employee-onboarding.handler.ts:38`

- **Path:** `PATCH /employees/:id/onboarding` (dashboard JWT required)
- **Bypass type:** `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `Employee` (scoped), `EmployeeBranch` (scoped), `EmployeeService` (scoped)
- **Why suspicious:** No `applyInTransaction(tx)`. Pre-tx fetch at line 30 is `prisma.employee.findFirst({ where: { id: cmd.employeeId } })` — no `organizationId` filter. The tx then updates `employee` by `{ id: cmd.employeeId }` only. The `branches`/`services` steps do propagate `employee.organizationId` into `createMany`, but the initial `update` at line 41 does not.
- **Risk:** A dashboard user from org A who knows org B's employeeId can update that employee's profile step.
- **Recommended action:** Add `organizationId` to the pre-tx `findFirst`. Add `applyInTransaction(tx)`. Alternatively confirm that the calling controller's `CaslGuard` enforces org-membership before the handler is reached — if so, downgrade to ✅ with a comment.

---

### 3. `set-client-active.handler.ts:41`

- **Path:** `PATCH /clients/:id/active` (dashboard JWT required)
- **Bypass type:** `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `Client` (scoped), `ClientRefreshToken` (scoped)
- **Why suspicious:** Pre-tx fetch is `prisma.client.findFirst({ where: { id: cmd.clientId, deletedAt: null } })` — no `organizationId`. The tx `update` at line 42 uses `where: { id: cmd.clientId }` only.
- **Risk:** Same as above — cross-tenant IDOR via known clientId, provided CaslGuard is the only org-scope check.
- **Recommended action:** Add `organizationId: this.tenant.requireOrganizationIdOrDefault()` to the pre-tx `findFirst` and to the tx `update.where`. Add `applyInTransaction(tx)`.

---

### 4. `moyasar-subscription-webhook.handler.ts:109–116` (Stage 3 systemContext window)

- **Path:** `POST /webhooks/moyasar/subscription` (public webhook)
- **Bypass type:** `systemContext` (raw `SYSTEM_CONTEXT_CLS_KEY`, not `$allTenants` under `SUPER_ADMIN_CONTEXT_CLS_KEY`)
- **Why suspicious:** Stage 3 sets `SYSTEM_CONTEXT_CLS_KEY = true` inside `cls.run()` to do a cross-tenant `subscriptionInvoice.findFirst`. The `SYSTEM_CONTEXT_CLS_KEY` bypass path in `tenant-scoping.extension.ts:78` disables the RLS guard entirely for the duration. This is correct for the use case (invoice lookup by Moyasar payment ID), but the pattern differs from every other cron/webhook which uses `$allTenants` under `SUPER_ADMIN_CONTEXT_CLS_KEY`. The inconsistency makes auditing harder and the window closes only when `cls.run` returns — if an exception bubbles out mid-window, CLS cleanup may not fire on all runtime paths.
- **Recommended action:** Replace the Stage 3 `SYSTEM_CONTEXT_CLS_KEY` window with `$allTenants.subscriptionInvoice.findFirst(...)` under `SUPER_ADMIN_CONTEXT_CLS_KEY` (same pattern Stage 4 already uses). Eliminates the weaker bypass path entirely.

---

### 5. `record-subscription-payment-failure.handler.ts:41`

- **Path:** Called from `MoyasarSubscriptionWebhookHandler` (internal, not directly exposed)
- **Bypass type:** `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `SubscriptionInvoice` (platform-level, NOT tenant-scoped), `Subscription` (platform-level), `DunningLog` (platform-level)
- **Why suspicious at first glance:** No `applyInTransaction`. However, all three tables are SaaS-platform models, not per-tenant scoped models in `SCOPED_MODELS`. The explicit `organizationId: sub.organizationId` on the `subscription.update` is consistent with the "Lesson 8" comment pattern.
- **Verdict:** ✅ Actually safe — platform-level tables only. Listed here because the pattern looks suspicious without reading the schema.

---

### 6. `verify-email.handler.ts:45` (inside outer `cls.run` + `SYSTEM_CONTEXT_CLS_KEY`)

- **Path:** `GET /auth/verify-email?token=...` (public)
- **Bypass type:** `systemContext` + `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `EmailVerificationToken` (scoped?), `User` (scoped)
- **Why suspicious:** The handler wraps everything in `cls.run(() => { cls.set(SYSTEM_CONTEXT_CLS_KEY, true); ... })`. Inside this window it runs a `$transaction` that updates `User` by `{ id: record.userId }` only. No `applyInTransaction`. The outer `SYSTEM_CONTEXT_CLS_KEY` disables RLS for the entire window, which covers both the read and the tx write.
- **Risk:** Token is a strong secret (SHA-256 of a random token), so exploitation requires token theft. But if an attacker intercepts a token for user X in org A, they can mark org B's user verified by constructing a matching token collision — not feasible cryptographically. More realistic concern: the `SYSTEM_CONTEXT_CLS_KEY` bypass remains active for longer than necessary (covers the tx, not just the lookup).
- **Recommended action:** Narrow the systemContext window to cover only the initial `emailVerificationToken.findFirst`. Then run the tx under normal RLS (`applyInTransaction`) with explicit `userId` + whatever `organizationId` is available from `record`.

---

### 7. `request-dashboard-otp.handler.ts:53`

- **Path:** `POST /auth/dashboard/otp` (public)
- **Bypass type:** `$transaction` without `applyInTransaction`
- **Tables touched in tx:** `OtpCode` — notably `OtpCode` has no `organizationId` field in the dashboard-login path (cross-org by design)
- **Why suspicious:** No `applyInTransaction`. No `organizationId` on `OtpCode` rows for `DASHBOARD_LOGIN` purpose.
- **Verdict:** ✅ Intentional by design — dashboard login is cross-org. But must be documented explicitly so future reviewers don't patch it. Mark with a `// INTENTIONAL: OtpCode for DASHBOARD_LOGIN is cross-org; no organizationId filter` comment.

---

## ✅ Safe Paths (collapsed)

### `$transaction` with `applyInTransaction` present

- `apply-coupon.handler.ts:75` — `applyInTransaction` on line 76; all tx queries include `organizationId`. ✅
- `refund-payment.handler.ts:107` — `applyInTransaction` on line 108; all tx queries scoped. ✅
- `users/update-user.handler.ts:52` — `applyInTransaction` on line 53. ✅
- `identity/users/create-user.handler.ts:43` — `applyInTransaction` on line 44. ✅
- `finance/process-payment/process-payment.handler.ts:31` — `applyInTransaction` on line 32; `organizationId` in every tx query. ✅
- `identity/client-auth/reset-password/reset-password.handler.ts:61` — `applyInTransaction` on line 62. ✅
- `identity/accept-invitation/accept-invitation.handler.ts:61` — `applyInTransaction` on line 62. ✅
- `finance/refund-payment/approve-refund.handler.ts:74` — `applyInTransaction` called (confirmed in wider context). ✅

### `$transaction` on non-scoped (platform) tables only

- `platform/billing/record-subscription-payment-failure/...` — `SubscriptionInvoice`, `Subscription`, `DunningLog` are platform-level. ✅
- `platform/admin/update-plan/update-plan.handler.ts:42` — uses `$allTenants.$transaction`; touches `Plan` (platform). ✅
- `platform/admin/create-vertical/...` — `$allTenants.$transaction`; touches `Vertical` (platform). ✅
- `platform/admin/end-impersonation/...` — `$allTenants.$transaction`; touches `ImpersonationSession`. ✅
- `platform/admin/create-tenant/...` — `$allTenants.$transaction`; touches `Organization`, `Membership` (both are being created fresh here). ✅
- `platform/admin/archive-organization/...` — `$allTenants.$transaction`; super-admin context. ✅
- `platform/admin/admin-cancel-scheduled/...` — `$allTenants.$transaction`. ✅
- `platform/admin/create-plan/...` — `$allTenants.$transaction`; `Plan`. ✅
- `platform/admin/update-vertical/...` — `$allTenants.$transaction`; `Vertical`. ✅
- `platform/admin/delete-vertical/...` — `$allTenants.$transaction`; `Vertical`. ✅
- `platform/admin/update-organization/...` — `$allTenants.$transaction`; `Organization`. ✅
- `platform/admin/admin-waive-invoice/...` — `$allTenants.$transaction`; `SubscriptionInvoice`. ✅
- `platform/admin/admin-grant-credit/...` — `$allTenants.$transaction`; `BillingCredit`. ✅
- `platform/admin/admin-refund-invoice/...` — `$allTenants.$transaction`; `SubscriptionInvoice`. ✅
- `platform/admin/suspend-organization/...` — `$allTenants.$transaction`; `Organization`. ✅
- `platform/admin/admin-change-plan-for-org/...` — `$allTenants.$transaction`; `Subscription`. ✅
- `platform/admin/reinstate-organization/...` — `$allTenants.$transaction`; `Organization`. ✅
- `platform/admin/reset-user-password/...` — `$allTenants.$transaction`; super-admin path. ✅
- `platform/admin/start-impersonation/...` — `$allTenants.$transaction`; `ImpersonationSession`. ✅
- `platform/admin/delete-plan/...` — `$allTenants.$transaction`; `Plan`. ✅
- `platform/verticals/seed-organization-from-vertical.handler.ts:28` — `$transaction`; all writes include explicit `organizationId: cmd.organizationId`. ✅
- `platform/billing/expire-trials/...` — `$allTenants.$transaction`; `Subscription`. ✅
- `platform/tenant-registration/register-tenant.handler.ts:87` — creates a new org from scratch; no pre-existing tenant context needed. ✅
- `common/interceptors/tenant-guc.interceptor.ts:59` — `$transaction` that only runs `set_config('app.current_org_id', ...)` — this IS the RLS enforcement mechanism itself. ✅

### `$transaction` with explicit `organizationId` in all where-clauses (no RLS needed)

- `ai/embed-document/embed-document.handler.ts:55` — `organizationId` passed explicitly into `createMany`. ✅
- `bookings/complete-booking/complete-booking.handler.ts:24` — `where: { id, organizationId }`. ✅
- `bookings/create-zoom-meeting/create-zoom-meeting.handler.ts:73` — uses `booking.organizationId` in all reads; advisory lock is per `(org, booking)`. ✅
- `people/employees/create-employee.handler.ts:32` — `organizationId` from `tenant.requireOrganizationIdOrDefault()` passed into every create; `assertLimitNotExceeded(tx, organizationId, ...)` called. ✅

### `$transaction` on non-scoped identity tables

- `identity/request-dashboard-otp/request-dashboard-otp.handler.ts:53` — `OtpCode` for `DASHBOARD_LOGIN` is intentionally cross-org (see ⚠️ #7 above — safe by design, needs comment). ✅
- `identity/otp/request-otp.handler.ts:91` — `OtpCode` tx includes `organizationId: orgId` in the `updateMany` where; the `create` relies on caller to set `organizationId`. Review `create` side — likely ✅ if `orgId` is passed.
- `identity/user-password-reset/perform-password-reset/perform-password-reset.handler.ts:48` — **listed under ⚠️ #1**.

### `systemContext` — legitimate webhook / pre-auth entry points

- `moyasar-webhook.handler.ts` (lines 71–72, 79–80, 111–112) — three paths (paid/failed/unknown), all set `SYSTEM_CONTEXT_CLS_KEY` inside `cls.run()` for cross-tenant payment lookup. Legitimate — no tenant context available from incoming webhook. ✅
- `comms/sms-dlr/sms-dlr.handler.ts` (lines 38–39, 64–65) — DLR webhook; cross-tenant config lookup by `organizationId` from URL. ✅
- `bookings/payment-completed-handler/payment-completed.handler.ts:38` — BullMQ job consumer; tenant resolved from job payload before systemContext set. ✅
- `identity/otp/verify-otp.handler.ts:27–28` — OTP verify runs before auth; cross-tenant lookup by identifier. ✅
- `identity/otp/request-otp.handler.ts:67–68` — same as verify-otp. ✅
- `identity/otp/otp-session.guard.ts:39–40` — guard runs before JWT; cross-tenant lookup. ✅
- `identity/verify-mobile-otp/verify-mobile-otp.handler.ts:52–53` — pre-auth path. ✅
- `identity/verify-email/verify-email.handler.ts:29–30` — **listed under ⚠️ #6** (safe but window too wide).
- `integrations/zoho-invoice/webhooks/handle-event.handler.ts:78` — webhook; systemContext for cross-tenant invoice lookup. ✅
- Cron log messages (`booking-expiry.cron.ts:50`, `charge-due-subscriptions.cron.ts:54`, etc.) — only log strings, not actual CLS sets. ✅

### `$allTenants` — all platform/admin/cron callers

All ~110 usages in `platform/admin/`, `platform/billing/`, `ops/cron-tasks/`, `common/interceptors/super-admin-context.interceptor.ts`, and `api/public/auth.controller.ts` are accessed either:

- Under `SuperAdminContextInterceptor` (all `src/api/admin/` routes) — ✅
- Inside `cls.run(() => { cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true); ... })` in crons/login/refresh — ✅
- In `prisma.service.ts:224` as the definition/gatekeeper itself — ✅

One exception: `moyasar-subscription-webhook.handler.ts:126` comment says it will use `$allTenants` but Stage 3 actually uses raw `SYSTEM_CONTEXT_CLS_KEY` instead — see ⚠️ #4.

### `runWithoutTenant`

- `rls.helper.ts:48` — definition only. No call sites found outside spec files. Not currently used in production code paths. ✅

### `requireOrganizationIdOrDefault` (~95 call sites)

All usages are in authenticated request handlers (dashboard controllers, mobile controllers, or handlers called only from authenticated paths). The method throws in strict mode if no tenant context is present, making it self-enforcing. No suspicious call sites found. ✅

---

## Recommendations

### Immediate (before next production deploy)

1. **Fix `perform-password-reset.handler.ts`** — Add `applyInTransaction(tx)`. Add `organizationId` to `PasswordResetToken.findFirst` pre-tx lookup (requires `organizationId` column on that table or a super-admin bypass to resolve it from `record.userId`).

2. **Fix `employee-onboarding.handler.ts`** — Add `applyInTransaction(tx)`. Add `organizationId` to pre-tx `employee.findFirst`. Confirm whether `CaslGuard` already enforces org scope at the controller level — if yes, a comment confirming this is sufficient.

3. **Fix `set-client-active.handler.ts`** — Add `organizationId` to both the pre-tx `client.findFirst` and the tx `client.update.where`. Add `applyInTransaction(tx)`.

### Short-term (next audit sprint)

4. **Consolidate webhook systemContext pattern** — Replace the Stage 3 raw `SYSTEM_CONTEXT_CLS_KEY` window in `moyasar-subscription-webhook.handler.ts` with `$allTenants` under `SUPER_ADMIN_CONTEXT_CLS_KEY`. Eliminates the weaker bypass path.

5. **Narrow `verify-email.handler.ts` systemContext window** — Move `SYSTEM_CONTEXT_CLS_KEY` to cover only the initial lookup, not the `$transaction`. Apply `applyInTransaction` (or explicit `userId` filter) inside the tx.

6. **Add documentation comments** on the three intentional cross-org patterns:
   - `request-dashboard-otp.handler.ts` — `// INTENTIONAL: OtpCode for DASHBOARD_LOGIN is cross-org; no organizationId`
   - `perform-password-reset.handler.ts` — `// TODO: add applyInTransaction after PasswordResetToken gains organizationId`
   - All `$allTenants` cron callers — already largely commented; confirm every new cron follows the `SUPER_ADMIN_CONTEXT_CLS_KEY` pattern.

7. **Add a lint rule or CI grep** — `$transaction(async` without `applyInTransaction` in the same block, on files outside `platform/admin/`. Flag for manual review on every PR.
