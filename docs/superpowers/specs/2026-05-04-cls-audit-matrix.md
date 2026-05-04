# CLS Audit Matrix — `$allTenants` Callsite Classification

**Date:** 2026-05-04
**Auditor:** sonnet-executor (Claude Sonnet 4.6)
**Repo path:** `apps/backend/src/`

---

## Sweep Command

```bash
cd apps/backend && rg -n '\$allTenants\.' src/ --files-with-matches \
  | grep -v '\.spec\.ts$' \
  | grep -v '/platform/admin/' \
  | sort
```

**Total files swept: 14**

---

## Admin Fence Verification

The admin fence was verified by running:

```bash
grep -rn "SuperAdminContextInterceptor" apps/backend/src/api/admin/
```

All 14 non-spec controller files in `src/api/admin/` apply `@UseInterceptors(SuperAdminContextInterceptor)` at the class level:

`audit-log.controller.ts`, `billing-settings.controller.ts`, `billing.controller.ts`, `branding-settings.controller.ts`, `impersonation.controller.ts`, `metrics.controller.ts`, `notifications-config.controller.ts`, `notifications.controller.ts`, `organizations.controller.ts`, `plans.controller.ts`, `platform-email.controller.ts`, `security-settings.controller.ts`, `settings.controller.ts`, `system-health.controller.ts`, `users.controller.ts`, `verticals.controller.ts`.

**Admin fence: COMPLETE — no P0 gaps found.** Every admin controller sets the CLS super-admin context before any handler executes.

---

## Classification Table

| File | Status | Entry Method | Evidence |
|---|---|---|---|
| `src/modules/platform/billing/charge-due-subscriptions/charge-due-subscriptions.cron.ts` | **SAFE** | `execute()` | `cls.run` at L39; `cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true)` at L40; `$allTenants` first used at L54 inside `runCharge()` called within the wrap. Canonical pattern. |
| `src/modules/ops/orphan-audit/run-orphan-audit.handler.ts` | **SAFE** | `execute()` | `cls.run` at L32; `cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true)` at L33; `$allTenants.organization.findMany` at L39 inside `runAudit()` called within the wrap. |
| `src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts` | **BROKEN** | `execute()` | `$allTenants.subscription.findMany` at L23 runs bare — no `ClsService` injected, no `cls.run`. Additional `$allTenants` calls at L60, L75, L101, L108. |
| `src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts` | **BROKEN** | `execute(cmd)` | `$allTenants.membership.findFirst` at L80 runs bare — no `ClsService` injected, no `cls.run`. SAFE when called from admin HTTP (interceptor in effect) but BROKEN when called from `charge-due-subscriptions.cron` or `dunning-retry.service` outside the interceptor lifecycle. Confirmed by failing e2e dunning-retry cases 3+6. |
| `src/modules/platform/billing/dunning-retry/dunning-retry.cron.ts` | **BROKEN** | `execute(now)` | `$allTenants.subscription.findMany` at L19 runs bare — no `ClsService` injected, no `cls.run`. |
| `src/modules/platform/billing/dunning-retry/dunning-retry.service.ts` | **BROKEN** | `sendFailureEmail()` (called from `retryInvoice` → `recordFailure`) | `$allTenants.membership.findFirst` at L213 runs bare — no `ClsService` injected, no `cls.run`. Called from `dunning-retry.cron.ts` which is itself BROKEN. |
| `src/modules/platform/billing/expire-trials/expire-trials.cron.ts` | **BROKEN** | `execute()` | Multiple `$allTenants` calls (L63 `cronHeartbeat.upsert`, L77 `cronHeartbeat.findUnique`, L96 `subscription.findMany`, L126 `subscription.update`, L134 `subscription.findMany`, L176 `$allTenants.$transaction`, L221 `subscriptionInvoice.create`, L279 `organization.update`, L321 `membership.findFirst`) — no `ClsService` injected, no `cls.run`. |
| `src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts` | **BROKEN** | `execute()` | `$allTenants.subscription.findMany` at L20; `$allTenants.subscription.update` at L30 — no `ClsService` injected, no `cls.run`. |
| `src/modules/platform/billing/grace-watchers/api-webhooks-grace.cron.ts` | **BROKEN** | `run()` | `$allTenants.subscription.findMany` at L22; `$allTenants.membership.findFirst` at L37 — no `ClsService` injected, no `cls.run`. |
| `src/modules/platform/billing/grace-watchers/custom-domain-grace.cron.ts` | **BROKEN** | `run()` | `$allTenants.organizationSettings.findMany` at L20; `$allTenants.membership.findFirst` at L33; `$allTenants.organizationSettings.update` at L70 — no `ClsService` injected, no `cls.run`. |
| `src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.ts` | **BROKEN** | `execute()` | `$allTenants.subscription.findMany` at L37; `$allTenants.employee.count` at L47; `$allTenants.branch.count` at L58; `$allTenants.usageCounter.findFirst` at L69; `$allTenants.client.count` at L80; `$allTenants.membership.findFirst` at L92; `$allTenants.notification.findFirst` at L106; `$allTenants.notification.create` at L120 — no `ClsService` injected, no `cls.run`. |
| `src/modules/ops/cron-tasks/reconcile-usage-counters/reconcile-usage-counters.handler.ts` | **BROKEN** | `execute()` | `$allTenants.organization.findMany` at L38 fires **before** the per-org `cls.run` loop at L48. The loop body (L48–L84) correctly sets both `TENANT_CLS_KEY` (L49) and `SUPER_ADMIN_CONTEXT_CLS_KEY` (L59), but the initial org-list fetch at L38 is outside any CLS context. |
| `src/modules/identity/invite-user/invite-user.handler.ts` | **BROKEN** | `execute(cmd)` | `$allTenants.membership.findFirst` at L36 runs bare — no `ClsService` injected, no `cls.run`. Route is `POST /auth/invite` with only `JwtGuard`; no admin interceptor applies. |
| `src/modules/platform/billing/downgrade-safety/downgrade-safety.service.ts` | **AMBIGUOUS** | `recomputeFromSource()` (called from `checkDowngrade` → `readCurrentUsage`) | `$allTenants.branch.count` at L335; `$allTenants.employee.count` at L339; `$allTenants.booking.count` at L344. This cold-start fallback path is SAFE when called from `DowngradePlanHandler` (admin HTTP — interceptor active) but BROKEN when called from `process-scheduled-plan-changes.cron.ts` (no `cls.run`). Classification resolves to SAFE once the cron is fixed (Task 2). |

---

## Summary Counts

| Classification | Count |
|---|---|
| SAFE | 2 |
| BROKEN | 11 |
| AMBIGUOUS | 1 |
| **Total swept** | **14** |
| Admin fence P0 gaps | 0 |

---

## BROKEN List — Input to Tasks 2–4

Ordered by severity (HIGH = confirmed by e2e failure or billing-critical path; MEDIUM = billing-adjacent cron).

### HIGH — Confirmed by e2e failure or payment-critical path

1. `src/modules/platform/billing/dunning-retry/dunning-retry.cron.ts`
   — Entry: `execute()`. Throws on `$allTenants.subscription.findMany` L19. Dunning loop never runs.
2. `src/modules/platform/billing/dunning-retry/dunning-retry.service.ts`
   — Entry: `sendFailureEmail()`. Throws on `$allTenants.membership.findFirst` L213 during failure notification path. Confirmed by failing e2e cases 3+6.
3. `src/modules/platform/billing/record-subscription-payment/record-subscription-payment.handler.ts`
   — Entry: `execute(cmd)`. Throws on `$allTenants.membership.findFirst` L80 when invoked from cron context (not admin HTTP). Confirmed by failing e2e dunning-retry cases 3+6.
4. `src/modules/platform/billing/process-scheduled-plan-changes/process-scheduled-plan-changes.cron.ts`
   — Entry: `execute()`. Throws on `$allTenants.subscription.findMany` L23. Scheduled plan changes never apply.
5. `src/modules/platform/billing/expire-trials/expire-trials.cron.ts`
   — Entry: `execute()`. Throws on first `$allTenants` call (L63). Trial expirations and conversion charges never run.

### MEDIUM — Billing-adjacent croon, no confirmed e2e failure yet

6. `src/modules/platform/billing/process-scheduled-cancellations/process-scheduled-cancellations.cron.ts`
   — Entry: `execute()`. Throws on `$allTenants.subscription.findMany` L20.
7. `src/modules/platform/billing/grace-watchers/api-webhooks-grace.cron.ts`
   — Entry: `run()`. Throws on `$allTenants.subscription.findMany` L22.
8. `src/modules/platform/billing/grace-watchers/custom-domain-grace.cron.ts`
   — Entry: `run()`. Throws on `$allTenants.organizationSettings.findMany` L20.
9. `src/modules/platform/billing/send-limit-warning/send-limit-warning.cron.ts`
   — Entry: `execute()`. Throws on `$allTenants.subscription.findMany` L37.
10. `src/modules/ops/cron-tasks/reconcile-usage-counters/reconcile-usage-counters.handler.ts`
    — Entry: `execute()`. Throws on `$allTenants.organization.findMany` L38 (before the per-org `cls.run` loop begins).
11. `src/modules/identity/invite-user/invite-user.handler.ts`
    — Entry: `execute(cmd)`. Throws on `$allTenants.membership.findFirst` L36. Every user invitation fails at runtime.

---

*Note on AMBIGUOUS:* `downgrade-safety.service.ts` will automatically resolve to SAFE once `process-scheduled-plan-changes.cron.ts` (item 4 above) is fixed with a `cls.run` wrap. No independent fix required in the service itself — the `$allTenants` calls there are in a cold-start fallback that only fires when the UsageCounter cache is empty, and they will be covered by the cron's outer wrap once that wrap exists.
