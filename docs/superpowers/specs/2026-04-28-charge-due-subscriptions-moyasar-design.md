# Close the SaaS Billing Charge Loop (Moyasar Recurring)

**Status:** drafted, not implemented (follow-up to 2026-04-28 P0 sweep).
**Owner:** @tariq.
**Severity:** P0 for revenue (no clinic subscriptions are being collected).

## Problem

`ChargeDueSubscriptionsCron.chargeSubscription()` (line 47–75) creates a
`SubscriptionInvoice` with status `DUE` and stops there. The intended next
step — `MoyasarSubscriptionClient.chargeWithToken(...)` — is a `TODO(Task
11)` comment. There is no upstream caller that fires the actual charge.

Result:

- Invoices accumulate in `DUE` forever.
- The Moyasar webhook (`record-subscription-payment`) is never triggered
  because there is no charge attempt.
- The `enforce-grace-period` cron walks subscriptions in `PAST_DUE` and
  suspends them — but they never reach `PAST_DUE` either, because nothing
  marked the invoice failed.

Zero platform revenue is being collected.

## Required loop

```
ChargeDueSubscriptionsCron
  └─ for each due Subscription
     ├─ ComputeOverageCron.computeForSubscription(...)
     ├─ create SubscriptionInvoice(amount = flat + overage, status = DUE)
     ├─ MoyasarSubscriptionClient.chargeWithToken(orgConfig, customerToken, amount)
     │    ├─ on success → handler-level webhook will mark PAID; invoice update
     │    │   is idempotent on (subscriptionId, periodStart)
     │    └─ on failure → record attempt in `SubscriptionPaymentAttempt`,
     │       transition Subscription to PAST_DUE if N consecutive failures
     └─ on Moyasar HTTP error → keep invoice DUE, retry next cron tick;
        emit Sentry breadcrumb tagged orgId
```

## Concrete tasks

1. **Schema:** add `SubscriptionPaymentAttempt(id, subscriptionInvoiceId,
   organizationId, attemptedAt, providerRef, status, errorCode)` —
   tenant-scoped, RLS enabled.
2. **Service:** `MoyasarSubscriptionClient.chargeWithToken({ orgConfig,
   customerToken, amount, idempotencyKey })`. The platform Moyasar account
   (different from per-tenant Moyasar) issues these charges. Idempotency
   key is `subscription:${id}:period:${periodStart.toISOString()}` so a
   retry within the same cron cycle does not double-charge.
3. **Cron rewrite:** include overage in the invoice amount; call
   `chargeWithToken`; persist attempt; transition state on result.
4. **Token storage:** clinic owners save a Moyasar tokenization at
   subscription start (`StartSubscriptionHandler` already accepts the
   token — verify the token is persisted on `Subscription.moyasarToken`
   AES-encrypted with the platform key, not the per-tenant key).
5. **Failure transitions:** 3 consecutive failed attempts → `PAST_DUE`;
   already-existing `EnforceGracePeriodCron` then escalates to
   `SUSPENDED` after the grace window.
6. **Tests:** unit (mock `MoyasarSubscriptionClient`), e2e against the
   Moyasar test environment (skip in CI behind `MOYASAR_E2E=true`),
   security suite (charge under another tenant's CLS context throws).

## Out of scope

- Per-tenant Moyasar credentials (this loop uses the **platform** Moyasar).
- ZATCA submission of platform invoices (separate compliance ticket).
- Email notifications on charge success/failure (existing comms slice).

## Why this is deferred, not done now

This is a 4-to-6-day implementation with live-payment risk. It requires:

- Wiring the platform Moyasar account (separate from the per-tenant
  account work delivered in PR #80).
- A token-vault decision (encrypted column vs Moyasar customer ref).
- A staged rollout against the Moyasar test environment with an explicit
  go-live cutover date.

The 2026-04-28 P0 sweep already ships the safety fences (strict-mode
fail-closed, tenant-resolver hardening, RLS for `Subscription` and
`UsageRecord`). Until this loop closes, billing remains in **manual**
mode — the platform owner must mark invoices PAID by hand. That state is
explicit and visible (`DUE` invoices accumulate), not silent.
