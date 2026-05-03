import { createHmac } from 'crypto';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { MoyasarSubscriptionWebhookHandler } from '../../../src/modules/finance/moyasar-api/moyasar-subscription-webhook.handler';

describe('SaaS-04 — Moyasar subscription webhook idempotency', () => {
  let h: IsolationHarness;
  let BASIC_PLAN_ID: string;

  const SECRET = 'test-moyasar-webhook-secret';

  function sign(rawBody: string): string {
    return createHmac('sha256', SECRET).update(rawBody).digest('hex');
  }

  function buildEvent(type: string, paymentId: string) {
    return {
      type,
      data: {
        id: paymentId,
        status: type === 'payment_paid' ? 'paid' : 'failed',
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
    h = await bootHarness();
    const basic = await h.prisma.plan.findFirstOrThrow({ where: { slug: 'BASIC' } });
    BASIC_PLAN_ID = basic.id;
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('payment_paid sent twice leaves subscription ACTIVE and invoice PAID exactly once', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`wh-idem-1-${ts}`, 'منظمة اختبار الإيدمبوتنسي');
    const paymentId = `pay-idem-paid-${ts}`;
    const { subscriptionId, invoiceId } = await seedSubscriptionWithInvoice(
      org.id,
      paymentId,
      'TRIALING',
    );

    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const event = buildEvent('payment_paid', paymentId);
    const raw = JSON.stringify(event);
    const sig = sign(raw);

    const firstResult = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(firstResult).toEqual({ ok: true });

    const secondResult = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(secondResult).toEqual({ ok: true, deduped: true });

    const inv = await h.prisma.subscriptionInvoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(inv.status).toBe('PAID');
    expect(inv.paidAt).not.toBeNull();

    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.lastPaymentAt).not.toBeNull();
  });

  it('payment_failed sent twice leaves subscription PAST_DUE with retryCount 1 and attemptCount 1', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`wh-idem-2-${ts}`, 'منظمة اختبار فشل الدفع');
    const paymentId = `pay-idem-fail-${ts}`;
    const { subscriptionId, invoiceId } = await seedSubscriptionWithInvoice(
      org.id,
      paymentId,
      'ACTIVE',
    );

    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const event = buildEvent('payment_failed', paymentId);
    const raw = JSON.stringify(event);
    const sig = sign(raw);

    const firstResult = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(firstResult).toEqual({ ok: true });

    const secondResult = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(secondResult).toEqual({ ok: true, deduped: true });

    const inv = await h.prisma.subscriptionInvoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(inv.status).toBe('FAILED');
    expect(inv.attemptCount).toBe(1);

    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('PAST_DUE');
    expect(sub.retryCount).toBe(1);
  });

  it('payment_paid received again for an already-ACTIVE subscription is safe and returns ok', async () => {
    const ts = Date.now();
    const org = await h.createOrg(`wh-idem-3-${ts}`, 'منظمة اشتراك نشط مكرر');
    const paymentId = `pay-idem-active-${ts}`;
    const { subscriptionId, invoiceId } = await seedSubscriptionWithInvoice(
      org.id,
      paymentId,
      'TRIALING',
    );

    const webhook = h.app.get(MoyasarSubscriptionWebhookHandler);
    const event = buildEvent('payment_paid', paymentId);
    const raw = JSON.stringify(event);
    const sig = sign(raw);

    await webhook.execute(Buffer.from(raw, 'utf8'), sig);

    const subAfterFirst = await h.prisma.subscription.findFirstOrThrow({
      where: { id: subscriptionId },
    });
    expect(subAfterFirst.status).toBe('ACTIVE');

    const duplicateResult = await webhook.execute(Buffer.from(raw, 'utf8'), sig);
    expect(duplicateResult).toEqual({ ok: true, deduped: true });

    const inv = await h.prisma.subscriptionInvoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(inv.status).toBe('PAID');

    const sub = await h.prisma.subscription.findFirstOrThrow({ where: { id: subscriptionId } });
    expect(sub.status).toBe('ACTIVE');
  });
});
