# SaaS-02e Finance Cluster — Pre-flight Callsite Audit

**Date:** 2026-04-21
**Branch:** `feat/saas-02e-finance-cluster`
**Plan:** `docs/superpowers/plans/2026-04-21-saas-02e-finance-cluster.md`

All greps run against `apps/backend/src/`, excluding `.spec.ts` and `.dto.ts`.

---

## 1.1 Invoice create callsites

```
src/modules/bookings/public/create-guest-booking.handler.ts:178:      const invoice = await tx.invoice.create({
src/modules/finance/create-invoice/create-invoice.handler.ts:32:    const invoice = await this.prisma.invoice.create({
```

**Matches expected.** Two callsites — `create-invoice.handler.ts` (authenticated path) and `create-guest-booking.handler.ts` (carries the `TODO(02e)` from plan 02d).

Non-create matches (filtered): `get-booking-invoice.handler.ts:45`, `get-public-invoice.handler.ts:65`, event publish on `create-invoice.handler.ts:50` — these are not `.create()` calls, just read/publish.

## 1.2 Payment create / upsert / tx callsites

```
src/modules/finance/payments/public/init-guest-payment/init-guest-payment.handler.ts:59:    const payment = await this.prisma.payment.create({
src/modules/finance/process-payment/process-payment.handler.ts:36:        createdPayment = await tx.payment.create({
src/modules/finance/process-payment/process-payment.handler.ts:55:          const existing = await tx.payment.findUnique({
src/modules/finance/process-payment/process-payment.handler.ts:63:      const totalPaid = await tx.payment.aggregate({
src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler.ts:45:    const payment = await this.prisma.payment.create({
src/modules/finance/moyasar-webhook/moyasar-webhook.handler.ts:79:    const payment = await this.prisma.payment.upsert({
src/modules/finance/verify-payment/verify-payment.handler.ts:48:        const updated = await tx.payment.update({
src/modules/finance/verify-payment/verify-payment.handler.ts:64:        const totalPaid = await tx.payment.aggregate({
```

**Matches expected + additional tx read/update callsites.**
- `process-payment.handler.ts:55` — `tx.payment.findUnique` — needs `findFirst` + explicit `organizationId` per Task 6.1.
- `process-payment.handler.ts:63` — `tx.payment.aggregate` inside callback tx → needs explicit `organizationId` in where.
- `verify-payment.handler.ts:48,64` — `tx.payment.update` and `tx.payment.aggregate` inside callback tx → Task 6.2 covers.

## 1.3 Coupon + CouponRedemption callsites

```
src/modules/finance/coupons/create-coupon.handler.ts:18:    return this.prisma.coupon.create({
src/modules/finance/apply-coupon/apply-coupon.handler.ts:49:        const { count } = await tx.coupon.updateMany({
src/modules/finance/apply-coupon/apply-coupon.handler.ts:55:        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
src/modules/finance/apply-coupon/apply-coupon.handler.ts:58:      const redemption = await tx.couponRedemption.create({
```

**Matches expected.** Task 5.3 (create-coupon) + Task 5.4 (apply-coupon callback tx).

## 1.4 RefundRequest callsites

```
src/modules/finance/refund-payment/request-refund.handler.ts:67:    const refundRequest = await this.prisma.refundRequest.create({
```

**Matches expected.** Only `request-refund.handler.ts` creates RefundRequest (Task 5.5).

## 1.5 ZatcaSubmission + ZatcaConfig callsites

```
src/modules/finance/zatca-config/onboard-zatca.handler.ts:16:    const config = await this.prisma.zatcaConfig.findUnique({
src/modules/finance/zatca-config/onboard-zatca.handler.ts:21:    return this.prisma.zatcaConfig.upsert({
src/modules/finance/zatca-config/get-zatca-config.handler.ts:11:    return this.prisma.zatcaConfig.upsert({
src/modules/finance/zatca-config/upsert-zatca-config.handler.ts:12:    return this.prisma.zatcaConfig.upsert({
src/modules/finance/zatca-submit/zatca-submit.handler.ts:42:    const existing = await this.prisma.zatcaSubmission.findUnique({
src/modules/finance/zatca-submit/zatca-submit.handler.ts:51:      ? await this.prisma.zatcaSubmission.update({
src/modules/finance/zatca-submit/zatca-submit.handler.ts:55:      : await this.prisma.zatcaSubmission.create({
src/modules/finance/zatca-submit/zatca-submit.handler.ts:73:    submission = await this.prisma.zatcaSubmission.update({
```

**Matches expected.** All ZATCA callsites live under `modules/finance/zatca-config/*` and `modules/finance/zatca-submit/*`. No surprise callsites in other domains.

## 1.6 `$transaction(async` callback-form callsites

```
src/common/tenant/rls.helper.ts:11              (docstring example — not code)
src/modules/identity/client-auth/reset-password/reset-password.handler.ts:39  (02a — already scoped)
src/modules/identity/otp/request-otp.handler.ts:56                            (02a — already scoped)
src/modules/bookings/testing/booking-test-helpers.ts:79                       (test-only helper)
src/modules/bookings/public/create-guest-booking.handler.ts:95                (02d — carries TODO(02e))
src/modules/ai/embed-document/embed-document.handler.ts:50                    (AI cluster — out of scope for 02e)
src/modules/people/clients/set-client-active/set-client-active.handler.ts:41  (02b — already scoped)
src/modules/people/employees/employee-onboarding.handler.ts:38                (02b — already scoped)
src/modules/finance/process-payment/process-payment.handler.ts:23             (Task 6.1)
src/modules/finance/apply-coupon/apply-coupon.handler.ts:45                   (Task 5.4)
```

**Finance callback-form tx: exactly the two expected** (`process-payment` + `apply-coupon`).

**Divergence from plan-expected bookings list:** plan §1.6 listed `create-booking`, `create-recurring-booking`, `create-guest-booking`, `reschedule-booking`, `client-reschedule-booking` as expected callback-form uses. Current grep shows ONLY `create-guest-booking` — the other four were converted to array-form `$transaction([...])` by plan 02d (commit `55304b03`). This is not a regression; it's a correctness improvement that 02d delivered. No action needed in 02e beyond the existing `create-guest-booking` invoice-TODO fix in Task 5.1.

Non-finance callback txs already scoped by their owning clusters (02a identity, 02b people) — out of scope for 02e.

`src/modules/ai/embed-document/embed-document.handler.ts:50` — AI cluster callback tx. Out of scope for 02e (future plan will cover AI cluster). Does not create finance rows.

---

## Owner-only files confirmed

| File | Status |
|---|---|
| `moyasar-webhook/moyasar-webhook.handler.ts` | Exactly one file — as expected. Task 8. |
| `zatca-config/*.handler.ts` | Three files (get, upsert, onboard) — as expected. Task 7.1–7.3. |
| `zatca-submit/zatca-submit.handler.ts` | One file — as expected. Task 7.5. |

No ZATCA or Moyasar callsite appears outside the expected list. No escalation required.

---

## Conclusion

Callsite audit confirms the plan's file-list is complete and no hidden callsites exist. Safe to proceed to Task 2 (schema changes).
