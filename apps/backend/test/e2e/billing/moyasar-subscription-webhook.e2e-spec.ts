import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { MoyasarSubscriptionWebhookHandler } from '../../../src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler';

/**
 * SaaS-04 Task 14D — Moyasar subscription webhook e2e.
 *
 * Platform-level webhook (separate from tenant Moyasar, Plan 02e). Tenant is
 * resolved from the invoice's subscription.organizationId, never from headers.
 *
 * Verified scenarios:
 * 1. Invalid signature → UnauthorizedException.
 * 2. Valid signature, unknown payment id → { ok: true }, no DB mutation.
 * 3. payment_paid → SubscriptionInvoice → PAID, Subscription → ACTIVE.
 * 4. payment_failed → invoice FAILED, retryCount incremented, PAST_DUE.
 */
describe('SaaS-04 — Moyasar subscription webhook', () => {
  let h: IsolationHarness;

  let BASIC_PLAN_ID: string;
  // Must match MOYASAR_PLATFORM_WEBHOOK_SECRET set by bootHarness (line 63 of isolation-harness.ts).
  const SECRET = 'test-moyasar-webhook-secret';

  function sign(rawBody: string): string {
    return createHmac('sha256', SECRET).update(rawBody).digest('hex');
  }

  function buildEvent(type: string, paymentId: string, message?: string) {
    return {
      type,
      data: {
        id: paymentId,
        status: type === 'payment_paid' ? 'paid' : 'failed',
        ...(message ? { source: { message } } : {}),
      },
    };
  }

  async function seedSubscriptionWithInvoice(
    organizationId: string,
    paymentId: string,
    subStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' = 'TRIALING',
  ): Promise<{ subscriptionId: string; invoiceId: string }> {
    const now = new Date();
    const sub = await h.prisma.subscription.create({
      data: {
        organizationId,
        planId: BASIC_PLAN_ID,
        status: subStatus,
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
      select: { id: true },
    });
    const inv = await h.prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: sub.id,
        organizationId,
        amount: 299,
        flatAmount: 299,
        overageAmount: 0,
        lineItems: [],
        status: 'DRAFT',
        billingCycle: 'MONTHLY',
        periodStart: now,
        periodEnd: new Date(now.getTime() + 30 * 86_400_000),
        dueDate: new Date(now.getTime() + 5 * 86_400_000),
        moyasarPaymentId: paymentId,
      },
      select: { id: true },
    });
    return { subscriptionId: sub.id, invoiceId: inv.id };
  }

  beforeAll(async () => {
    process.env.MOYASAR_PLATFORM_SECRET_KEY ??= 'test-platform-secret-key';
    // Note: bootHarness() unconditionally sets MOYASAR_PLATFORM_WEBHOOK_SECRET =
    // 'test-moyasar-webhook-secret' — SECRET above must match that value.
    h = await bootHarness();
    const basic = await h.prisma.plan.findFirstOrThrow({ where: { slug: 'BASIC' } });
    BASIC_PLAN_ID = basic.id;
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('rejects invalid signature with UnauthorizedException', async () => {
    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const raw = JSON.stringify(buildEvent('payment_paid', 'pay-sig-invalid'));

    await expect(
      webhook.execute(
        Buffer.from(raw, 'utf8'),
        'deadbeef00000000000000000000000000000000000000000000000000000000',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts valid signature with unknown payment id as noop { ok: true }', async () => {
    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const raw = JSON.stringify(buildEvent('payment_paid', 'pay-unknown-xyz'));
    const sig = sign(raw);

    const result = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(result).toEqual({ ok: true });
  });

  it('payment_paid → invoice PAID, subscription → ACTIVE', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`wh-paid-${ts}`, 'منظمة دفع ناجح');
    const paymentId = `pay-paid-${ts}`;
    const { subscriptionId, invoiceId } = await seedSubscriptionWithInvoice(
      org.id,
      paymentId,
      'TRIALING',
    );

    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const raw = JSON.stringify(buildEvent('payment_paid', paymentId));
    const sig = sign(raw);

    const result = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(result).toEqual({ ok: true });

    const inv = await h.prisma.subscriptionInvoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(inv.status).toBe('PAID');
    expect(inv.paidAt).not.toBeNull();

    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.lastPaymentAt).not.toBeNull();
    expect(sub.retryCount).toBe(0);
  });

  it('payment_failed → invoice FAILED, retryCount++, subscription → PAST_DUE', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`wh-fail-${ts}`, 'منظمة دفع فاشل');
    const paymentId = `pay-fail-${ts}`;
    const { subscriptionId, invoiceId } = await seedSubscriptionWithInvoice(
      org.id,
      paymentId,
      'ACTIVE',
    );

    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const raw = JSON.stringify(buildEvent('payment_failed', paymentId, 'card_declined'));
    const sig = sign(raw);

    const result = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(result).toEqual({ ok: true });

    const inv = await h.prisma.subscriptionInvoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(inv.status).toBe('FAILED');
    expect(inv.failureReason).toBe('card_declined');
    expect(inv.attemptCount).toBe(1);

    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('PAST_DUE');
    expect(sub.retryCount).toBe(1);
    expect(sub.pastDueSince).not.toBeNull();
    expect(sub.lastFailureReason).toBe('card_declined');
  });
});
