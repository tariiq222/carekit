import { createHmac } from 'crypto';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { MoyasarWebhookHandler } from '../../../src/modules/finance/moyasar-webhook/moyasar-webhook.handler';
import { EventBusService } from '../../../src/infrastructure/events';

/**
 * SaaS-02e §10.6 — Moyasar webhook tenant resolution (most important)
 *
 * Verifies that inbound unsigned/signed webhook events are correctly attributed
 * to the right tenant by resolving the invoice's organizationId from the
 * payload metadata — not from any ambient CLS context.
 *
 * Tests:
 * 1. Webhook for Org A invoice → Payment created under orgA.id
 * 2. Event envelope carries organizationId = orgA.id
 * 3. Second webhook for Org B invoice → Payment created under orgB.id
 * 4. list-payments runAs(A) returns orgA payment only; runAs(B) returns orgB only
 * 5. Idempotency: replay first webhook → { skipped: true }, no duplicate payment
 */
describe('SaaS-02e — Moyasar webhook tenant resolution', () => {
  let h: IsolationHarness;
  const SECRET = 'test-webhook-secret-02e';

  function sign(rawBody: string): string {
    return createHmac('sha256', SECRET).update(rawBody).digest('hex');
  }

  function buildPayload(invoiceId: string, paymentId: string) {
    return {
      id: paymentId,
      status: 'paid' as const,
      amount: 23000, // 230 SAR in halalas
      currency: 'SAR',
      metadata: { invoiceId },
    };
  }

  beforeAll(async () => {
    // Set the secret so the handler can read it from ConfigService
    process.env.MOYASAR_SECRET_KEY = SECRET;
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: seed a booking + invoice in a given org
  // ──────────────────────────────────────────────────────────────────────────

  async function seedInvoice(orgId: string, suffix: string): Promise<string> {
    const bookingId = crypto.randomUUID();
    await h.prisma.booking.create({
      data: {
        id: bookingId,
        organizationId: orgId,
        branchId: `br-wh-${suffix}`,
        clientId: `cli-wh-${suffix}`,
        employeeId: `emp-wh-${suffix}`,
        serviceId: `svc-wh-${suffix}`,
        scheduledAt: new Date('2031-09-01T10:00:00Z'),
        endsAt: new Date('2031-09-01T11:00:00Z'),
        durationMins: 60,
        price: 200,
        currency: 'SAR',
      },
    });

    const invoice = await h.prisma.invoice.create({
      data: {
        organizationId: orgId,
        bookingId,
        branchId: `br-wh-${suffix}`,
        clientId: `cli-wh-${suffix}`,
        employeeId: `emp-wh-${suffix}`,
        subtotal: 200,
        discountAmt: 0,
        vatRate: 0.15,
        vatAmt: 30,
        total: 230,
        status: 'ISSUED',
        issuedAt: new Date(),
        currency: 'SAR',
      },
      select: { id: true },
    });

    return invoice.id;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Main test: cross-org webhook + idempotency
  // ──────────────────────────────────────────────────────────────────────────

  it('webhook resolves to correct org; cross-org payments isolated; idempotency works', async () => {
    const ts = Date.now();
    const orgA = await h.createOrg(`wh-iso-a-${ts}`, 'منظمة ويب هوك أ');
    const orgB = await h.createOrg(`wh-iso-b-${ts}`, 'منظمة ويب هوك ب');

    // Seed invoices without tenant CLS (raw — webhook handler reads system context)
    const invAId = await seedInvoice(orgA.id, `a-${ts}`);
    const invBId = await seedInvoice(orgB.id, `b-${ts}`);

    const webhookHandler = h.app.get(MoyasarWebhookHandler);
    const eventBus = h.app.get(EventBusService);

    // Spy on eventBus.publish to capture event envelopes
    const publishedEvents: Array<{ name: string; envelope: unknown }> = [];
    const originalPublish = eventBus.publish.bind(eventBus);
    jest
      .spyOn(eventBus, 'publish')
      .mockImplementation(async (eventName: string, envelope: unknown) => {
        publishedEvents.push({ name: eventName, envelope });
        return originalPublish(eventName, envelope as Parameters<typeof originalPublish>[1]);
      });

    // ── Send webhook for Org A invoice ──────────────────────────────────────
    const paymentIdA = `mys-wh-a-${ts}`;
    const payloadA = buildPayload(invAId, paymentIdA);
    const rawBodyA = JSON.stringify(payloadA);
    const sigA = sign(rawBodyA);

    const resultA = await webhookHandler.execute({
      payload: payloadA,
      rawBody: rawBodyA,
      signature: sigA,
    });
    expect(resultA).not.toHaveProperty('skipped');

    // Payment must be attributed to Org A
    const payA = await h.prisma.payment.findFirst({
      where: { gatewayRef: paymentIdA },
    });
    expect(payA).not.toBeNull();
    expect(payA!.organizationId).toBe(orgA.id);

    // Event envelope must carry organizationId = orgA.id
    const eventA = publishedEvents.find((e) => e.name === 'finance.payment.completed');
    expect(eventA).toBeDefined();
    const envelopeA = eventA!.envelope as {
      payload: { organizationId?: string };
    };
    expect(envelopeA.payload.organizationId).toBe(orgA.id);

    publishedEvents.length = 0; // reset for Org B

    // ── Send webhook for Org B invoice ──────────────────────────────────────
    const paymentIdB = `mys-wh-b-${ts}`;
    const payloadB = buildPayload(invBId, paymentIdB);
    const rawBodyB = JSON.stringify(payloadB);
    const sigB = sign(rawBodyB);

    const resultB = await webhookHandler.execute({
      payload: payloadB,
      rawBody: rawBodyB,
      signature: sigB,
    });
    expect(resultB).not.toHaveProperty('skipped');

    // Payment must be attributed to Org B
    const payB = await h.prisma.payment.findFirst({
      where: { gatewayRef: paymentIdB },
    });
    expect(payB).not.toBeNull();
    expect(payB!.organizationId).toBe(orgB.id);

    // Event envelope must carry organizationId = orgB.id
    const eventB = publishedEvents.find((e) => e.name === 'finance.payment.completed');
    expect(eventB).toBeDefined();
    const envelopeB = eventB!.envelope as { payload: { organizationId?: string } };
    expect(envelopeB.payload.organizationId).toBe(orgB.id);

    // ── Isolation: list-payments scoped by CLS context ───────────────────────
    let paymentsFromA: Awaited<ReturnType<typeof h.prisma.payment.findMany>>;
    await h.runAs({ organizationId: orgA.id }, async () => {
      paymentsFromA = await h.prisma.payment.findMany({
        where: { gatewayRef: { in: [paymentIdA, paymentIdB] } },
      });
    });
    expect(paymentsFromA!).toHaveLength(1);
    expect(paymentsFromA![0].organizationId).toBe(orgA.id);

    let paymentsFromB: Awaited<ReturnType<typeof h.prisma.payment.findMany>>;
    await h.runAs({ organizationId: orgB.id }, async () => {
      paymentsFromB = await h.prisma.payment.findMany({
        where: { gatewayRef: { in: [paymentIdA, paymentIdB] } },
      });
    });
    expect(paymentsFromB!).toHaveLength(1);
    expect(paymentsFromB![0].organizationId).toBe(orgB.id);

    // ── Idempotency: replay Org A's webhook ─────────────────────────────────
    const idempotentResult = await webhookHandler.execute({
      payload: payloadA,
      rawBody: rawBodyA,
      signature: sigA,
    });
    expect(idempotentResult).toEqual({ skipped: true });

    // No duplicate payment created
    const countA = await h.prisma.payment.count({
      where: { gatewayRef: paymentIdA },
    });
    expect(countA).toBe(1);

    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Invalid signature is rejected
  // ──────────────────────────────────────────────────────────────────────────

  it('webhook with invalid signature is rejected', async () => {
    const ts = Date.now();
    const orgA = await h.createOrg(`wh-sig-a-${ts}`, 'منظمة توقيع أ');
    const invId = await seedInvoice(orgA.id, `sig-${ts}`);
    const payload = buildPayload(invId, `mys-sig-${ts}`);
    const rawBody = JSON.stringify(payload);

    const webhookHandler = h.app.get(MoyasarWebhookHandler);

    await expect(
      webhookHandler.execute({
        payload,
        rawBody,
        signature: 'deadbeef00000000000000000000000000000000000000000000000000000000',
      }),
    ).rejects.toThrow();
  });
});
