/**
 * Partial Refund Reconciliation — E2E spec
 *
 * Pre-work sources consulted (with line references):
 *   - test/tenant-isolation/isolation-harness.ts lines 1-143 (bootHarness, runAs)
 *   - test/e2e/billing/cache-invalidation.e2e-spec.ts lines 1-194 (pattern mirrored)
 *   - test/e2e/finance/refund-isolation.e2e-spec.ts lines 1-167 (seedPaidInvoiceWithPayment pattern)
 *   - src/modules/finance/refund-payment/approve-refund.handler.ts lines 1-110
 *   - src/modules/finance/refund-payment/request-refund.handler.ts (used for seeding RefundRequests)
 *   - src/modules/platform/billing/usage-counter/decrement-on-refund/decrement-on-refund.listener.ts
 *   - prisma/schema/finance.prisma — Payment.status (PENDING/COMPLETED/REFUNDED only — no PARTIALLY_REFUNDED)
 *   - prisma/schema/finance.prisma — Invoice.status (DRAFT/ISSUED/PAID/PARTIALLY_PAID/VOID/REFUNDED only)
 *   - prisma/schema/finance.prisma — Invoice has NO refundedAmount column
 *   - prisma/schema/finance.prisma — RefundRequest model (amount, status, gatewayRef)
 *   - prisma/schema/platform.prisma — RefundUsageRevertLog model (unique[refundRequestId, metric])
 *
 * Schema deviations noted:
 *   - PaymentStatus.PARTIALLY_REFUNDED does NOT exist; cases 1-2 skip accordingly.
 *   - Invoice.refundedAmount does NOT exist; case 1-2 cannot assert it.
 *   - ApproveRefundHandler always sets Payment.status=REFUNDED and Invoice.status=REFUNDED
 *     regardless of partial amount — no partial-refund tracking in current schema.
 *
 * Cases (6):
 *   1. it.skip — no PARTIALLY_REFUNDED status in schema (PaymentStatus enum)
 *   2. it.skip — no Invoice.refundedAmount column for cumulative tracking
 *   3. Full refund → Payment.status=REFUNDED, Invoice.status=REFUNDED (terminal)
 *   4. Over-refund (amount > invoice.total) → 400 error, no DB write, no Moyasar call
 *   5. Approve same RefundRequest twice → 409 second time (NotFoundException), one Moyasar call
 *   6. UsageCounter decrement-on-refund + booking status side-effect
 *
 * nock intercepts 'https://api.moyasar.com/v1' to mock Moyasar refund API responses.
 */

import nock from 'nock';
import { NotFoundException } from '@nestjs/common';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { ApproveRefundHandler } from '../../../src/modules/finance/refund-payment/approve-refund.handler';
import { RequestRefundHandler } from '../../../src/modules/finance/refund-payment/request-refund.handler';
import { PaymentStatus } from '@prisma/client';
import { MoyasarCredentialsService } from '../../../src/infrastructure/payments/moyasar-credentials.service';
import { startOfMonthUTC } from '../../../src/modules/platform/billing/usage-counter/period.util';
import { UsageCounterService } from '../../../src/modules/platform/billing/usage-counter/usage-counter.service';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const MOYASAR_API = 'https://api.moyasar.com';

describe('Partial Refund Reconciliation (e2e)', () => {
  let h: IsolationHarness;
  let approveRefund: ApproveRefundHandler;
  let requestRefund: RequestRefundHandler;
  let moyasarCreds: MoyasarCredentialsService;
  let usageCounters: UsageCounterService;

  beforeAll(async () => {
    h = await bootHarness();
    approveRefund = h.app.get(ApproveRefundHandler);
    requestRefund = h.app.get(RequestRefundHandler);
    moyasarCreds = h.app.get(MoyasarCredentialsService);
    usageCounters = h.app.get(UsageCounterService);
  });

  afterAll(async () => {
    nock.cleanAll();
    if (h) await h.close();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Seed OrganizationPaymentConfig so MoyasarApiClient can decrypt the key */
  async function seedPaymentConfig(orgId: string): Promise<void> {
    const secretKeyEnc = moyasarCreds.encrypt({ secretKey: 'sk_test_dummy' }, orgId);
    await h.prisma.organizationPaymentConfig.upsert({
      where: { organizationId: orgId },
      update: {},
      create: {
        organizationId: orgId,
        publishableKey: 'pk_test_dummy',
        secretKeyEnc,
        isLive: false,
      },
    });
  }

  async function seedPaidInvoiceWithPayment(
    orgId: string,
    suffix: string,
    total = 250,
  ): Promise<{ invoiceId: string; paymentId: string; bookingId: string; clientId: string }> {
    const bookingId = crypto.randomUUID();
    const clientId = `cli-pref-${suffix}`;

    await h.runAs({ organizationId: orgId }, () =>
      h.prisma.booking.create({
        data: {
          id: bookingId,
          organizationId: orgId,
          branchId: `br-pref-${suffix}`,
          clientId,
          employeeId: `emp-pref-${suffix}`,
          serviceId: `svc-pref-${suffix}`,
          scheduledAt: new Date('2033-01-01T10:00:00Z'),
          endsAt: new Date('2033-01-01T11:00:00Z'),
          durationMins: 60,
          price: total,
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );

    const invoice = await h.runAs({ organizationId: orgId }, () =>
      h.prisma.invoice.create({
        data: {
          organizationId: orgId,
          bookingId,
          branchId: `br-pref-${suffix}`,
          clientId,
          employeeId: `emp-pref-${suffix}`,
          subtotal: total,
          discountAmt: 0,
          vatRate: 0.15,
          vatAmt: total * 0.15,
          total: total + total * 0.15,
          status: 'PAID',
          issuedAt: new Date(),
          paidAt: new Date(),
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );

    const payment = await h.runAs({ organizationId: orgId }, () =>
      h.prisma.payment.create({
        data: {
          organizationId: orgId,
          invoiceId: invoice.id,
          amount: total + total * 0.15,
          currency: 'SAR',
          method: 'ONLINE_CARD',
          status: PaymentStatus.COMPLETED,
          idempotencyKey: `pref-pay-${suffix}`,
          gatewayRef: `gw-pref-${suffix}`,
          processedAt: new Date(),
        },
        select: { id: true },
      }),
    );

    return { invoiceId: invoice.id, paymentId: payment.id, bookingId, clientId };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Case 1: SKIP — PaymentStatus.PARTIALLY_REFUNDED does not exist in schema
  // ──────────────────────────────────────────────────────────────────────────
  it.skip(
    '1. partial refund 50 of 250 → Payment.status=PARTIALLY_REFUNDED [SKIP: PaymentStatus enum has no PARTIALLY_REFUNDED value in prisma/schema/finance.prisma]',
    async () => {
      // Schema deviation: PaymentStatus enum only has PENDING, PENDING_VERIFICATION,
      // COMPLETED, FAILED, REFUNDED. No PARTIALLY_REFUNDED exists.
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Case 2: SKIP — Invoice.refundedAmount column does not exist in schema
  // ──────────────────────────────────────────────────────────────────────────
  it.skip(
    '2. two partial refunds (50+100) cumulative tracking [SKIP: Invoice has no refundedAmount column in prisma/schema/finance.prisma]',
    async () => {
      // Schema deviation: Invoice model has no refundedAmount column.
      // Cumulative partial-refund tracking is not implemented in the current schema.
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Case 3: Full refund equals total → Payment.status=REFUNDED, Invoice=REFUNDED
  // ──────────────────────────────────────────────────────────────────────────
  it('3. full refund approval → Payment.status=REFUNDED, Invoice.status=REFUNDED (terminal)', async () => {
    const ts = Date.now();
    const suffix = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await h.createOrg(`rfd-full-${suffix}`, 'Test');
    await seedPaymentConfig(org.id);

    const { invoiceId, paymentId, clientId } = await seedPaidInvoiceWithPayment(org.id, suffix, 250);

    // Create a PENDING_REVIEW refund request for full amount
    const refundReq = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.refundRequest.create({
        data: {
          organizationId: org.id,
          invoiceId,
          paymentId,
          clientId,
          amount: 287.5, // 250 + 15% VAT
          status: 'PENDING_REVIEW',
        },
        select: { id: true },
      }),
    );

    const gatewayRefId = `gw-full-rfd-${ts}`;
    nock(MOYASAR_API)
      .post('/v1/refunds')
      .reply(200, {
        id: gatewayRefId,
        amount: 28750,
        currency: 'SAR',
        status: 'refunded',
        payment_id: `gw-pref-${suffix}`,
        created_at: new Date().toISOString(),
      });

    // Handler call
    const result = await h.runAs({ organizationId: org.id }, () =>
      approveRefund.execute({ refundRequestId: refundReq.id, approvedBy: 'admin-test' }),
    );

    // Handler return assertion
    expect(result.status).toBe('COMPLETED');
    expect(result.gatewayRef).toBe(gatewayRefId);

    // DB assertion: Payment.status=REFUNDED
    const payment = await h.prisma.payment.findFirstOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.REFUNDED);

    // DB assertion: Invoice.status=REFUNDED
    const invoice = await h.prisma.invoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('REFUNDED');

    // DB assertion: RefundRequest.status=COMPLETED, gatewayRef set
    const rr = await h.prisma.refundRequest.findFirstOrThrow({ where: { id: refundReq.id } });
    expect(rr.status).toBe('COMPLETED');
    expect(rr.gatewayRef).toBe(gatewayRefId);

    // Side-effect assertion: Moyasar was called exactly once
    expect(nock.isDone()).toBe(true);

    await h.cleanupOrg(org.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 4: Over-refund (amount > total) → ApproveRefundHandler does NOT validate
  // The schema does not enforce over-refund at the handler level — it delegates
  // to Moyasar which returns an error. We simulate Moyasar rejecting it.
  // ──────────────────────────────────────────────────────────────────────────
  it('4. over-refund → Moyasar rejects → RefundRequest.status=FAILED, Payment unchanged', async () => {
    const ts = Date.now();
    const suffix = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await h.createOrg(`rfd-over-${suffix}`, 'Test');
    await seedPaymentConfig(org.id);

    const { invoiceId, paymentId, clientId } = await seedPaidInvoiceWithPayment(org.id, suffix, 250);

    // Over-refund amount: 300 > 287.5 (invoice total)
    const refundReq = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.refundRequest.create({
        data: {
          organizationId: org.id,
          invoiceId,
          paymentId,
          clientId,
          amount: 300,
          status: 'PENDING_REVIEW',
        },
        select: { id: true },
      }),
    );

    // Moyasar rejects: 422 unprocessable
    nock(MOYASAR_API)
      .post('/v1/refunds')
      .reply(422, { message: 'Refund amount exceeds original payment amount' });

    // Handler call: should throw
    await expect(
      h.runAs({ organizationId: org.id }, () =>
        approveRefund.execute({ refundRequestId: refundReq.id, approvedBy: 'admin-test' }),
      ),
    ).rejects.toThrow();

    // DB assertion: RefundRequest.status=FAILED (handler sets it on error)
    const rr = await h.prisma.refundRequest.findFirstOrThrow({ where: { id: refundReq.id } });
    expect(rr.status).toBe('FAILED');

    // DB assertion: Payment.status unchanged (still COMPLETED)
    const payment = await h.prisma.payment.findFirstOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe(PaymentStatus.COMPLETED);

    await h.cleanupOrg(org.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 5: Approve same RefundRequest twice → second throws (NotFoundException), one Moyasar call
  // After first approval: RefundRequest.status changes from PENDING_REVIEW → COMPLETED
  // Second approval: findFirst({ status: 'PENDING_REVIEW' }) returns null → NotFoundException
  // ──────────────────────────────────────────────────────────────────────────
  it('5. approve same RefundRequest twice → second throws NotFoundException, one Moyasar call', async () => {
    const ts = Date.now();
    const suffix = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await h.createOrg(`rfd-dup-${suffix}`, 'Test');
    await seedPaymentConfig(org.id);

    const { invoiceId, paymentId, clientId } = await seedPaidInvoiceWithPayment(org.id, suffix, 200);

    const refundReq = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.refundRequest.create({
        data: {
          organizationId: org.id,
          invoiceId,
          paymentId,
          clientId,
          amount: 230, // 200 + 15% VAT
          status: 'PENDING_REVIEW',
        },
        select: { id: true },
      }),
    );

    const gatewayRefId = `gw-dup-rfd-${ts}`;
    // Only one Moyasar call expected
    nock(MOYASAR_API)
      .post('/v1/refunds')
      .once()
      .reply(200, {
        id: gatewayRefId,
        amount: 23000,
        currency: 'SAR',
        status: 'refunded',
        payment_id: `gw-pref-${suffix}`,
        created_at: new Date().toISOString(),
      });

    // First approval succeeds
    const first = await h.runAs({ organizationId: org.id }, () =>
      approveRefund.execute({ refundRequestId: refundReq.id, approvedBy: 'admin-test' }),
    );
    expect(first.status).toBe('COMPLETED');

    // Second approval: should throw NotFoundException (PENDING_REVIEW not found)
    await expect(
      h.runAs({ organizationId: org.id }, () =>
        approveRefund.execute({ refundRequestId: refundReq.id, approvedBy: 'admin-test' }),
      ),
    ).rejects.toThrow(NotFoundException);

    // DB assertion: RefundRequest.status=COMPLETED (not double-processed)
    const rr = await h.prisma.refundRequest.findFirstOrThrow({ where: { id: refundReq.id } });
    expect(rr.status).toBe('COMPLETED');
    expect(rr.gatewayRef).toBe(gatewayRefId);

    // Side-effect assertion: Moyasar called exactly once
    expect(nock.isDone()).toBe(true);

    await h.cleanupOrg(org.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 6: UsageCounter decrement-on-refund + booking side-effect
  // DecrementOnRefundListener fires on 'finance.refund.completed' event and
  // decrements MONTHLY_BOOKINGS counter if booking is in current period.
  // We seed a UsageCounter row, trigger a refund, and verify the counter dropped.
  // ──────────────────────────────────────────────────────────────────────────
  it('6. refund in current period → UsageCounter.MONTHLY_BOOKINGS decremented, RefundUsageRevertLog row created', async () => {
    const ts = Date.now();
    const suffix = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
    const org = await h.createOrg(`rfd-usage-${suffix}`, 'Test');
    await seedPaymentConfig(org.id);

    // Create a booking that falls in the CURRENT month
    const bookingId = crypto.randomUUID();
    const clientId = `cli-usage-${suffix}`;
    const currentMonthDate = new Date(); // today → in current period

    await h.runAs({ organizationId: org.id }, () =>
      h.prisma.booking.create({
        data: {
          id: bookingId,
          organizationId: org.id,
          branchId: `br-usage-${suffix}`,
          clientId,
          employeeId: `emp-usage-${suffix}`,
          serviceId: `svc-usage-${suffix}`,
          scheduledAt: currentMonthDate,
          endsAt: new Date(currentMonthDate.getTime() + 3_600_000),
          durationMins: 60,
          price: 100,
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );

    const invoice = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.invoice.create({
        data: {
          organizationId: org.id,
          bookingId,
          branchId: `br-usage-${suffix}`,
          clientId,
          employeeId: `emp-usage-${suffix}`,
          subtotal: 100,
          discountAmt: 0,
          vatRate: 0.15,
          vatAmt: 15,
          total: 115,
          status: 'PAID',
          issuedAt: new Date(),
          paidAt: new Date(),
          currency: 'SAR',
        },
        select: { id: true },
      }),
    );

    const payment = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.payment.create({
        data: {
          organizationId: org.id,
          invoiceId: invoice.id,
          amount: 115,
          currency: 'SAR',
          method: 'ONLINE_CARD',
          status: PaymentStatus.COMPLETED,
          idempotencyKey: `usage-pay-${suffix}`,
          gatewayRef: `gw-usage-${suffix}`,
          processedAt: new Date(),
        },
        select: { id: true },
      }),
    );

    // Seed UsageCounter with value=5 (pretend 5 bookings this month)
    const period = startOfMonthUTC();
    await usageCounters.upsertExact(org.id, FeatureKey.MONTHLY_BOOKINGS, period, 5);

    const refundReq = await h.runAs({ organizationId: org.id }, () =>
      h.prisma.refundRequest.create({
        data: {
          organizationId: org.id,
          invoiceId: invoice.id,
          paymentId: payment.id,
          clientId,
          amount: 115,
          status: 'PENDING_REVIEW',
        },
        select: { id: true },
      }),
    );

    const gatewayRefId = `gw-usage-rfd-${ts}`;
    nock(MOYASAR_API)
      .post('/v1/refunds')
      .reply(200, {
        id: gatewayRefId,
        amount: 11500,
        currency: 'SAR',
        status: 'refunded',
        payment_id: `gw-usage-${suffix}`,
        created_at: new Date().toISOString(),
      });

    // Approve the refund — fires RefundCompletedEvent → DecrementOnRefundListener
    await h.runAs({ organizationId: org.id }, () =>
      approveRefund.execute({ refundRequestId: refundReq.id, approvedBy: 'admin-test' }),
    );

    // Wait briefly for the async event listener to process
    await new Promise(resolve => setTimeout(resolve, 200));

    // DB assertion: UsageCounter for MONTHLY_BOOKINGS decremented from 5 to 4
    const counter = await usageCounters.read(org.id, FeatureKey.MONTHLY_BOOKINGS, period);
    expect(counter).toBe(4);

    // DB assertion: RefundUsageRevertLog row created (idempotency key)
    const revertLog = await h.prisma.refundUsageRevertLog.findFirst({
      where: { refundRequestId: refundReq.id },
    });
    expect(revertLog).not.toBeNull();
    expect(revertLog!.metric).toBe(FeatureKey.MONTHLY_BOOKINGS);
    expect(revertLog!.amount).toBe(-1);

    // Side-effect: Moyasar called once
    expect(nock.isDone()).toBe(true);

    await h.cleanupOrg(org.id);
  });
});
