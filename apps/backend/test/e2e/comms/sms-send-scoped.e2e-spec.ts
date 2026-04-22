import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { SmsProviderFactory } from '../../../src/infrastructure/sms/sms-provider.factory';
import { SendSmsHandler } from '../../../src/modules/comms/send-sms/send-sms.handler';

/**
 * SaaS-02g-sms §11 — send-sms tenant isolation.
 *
 * Two orgs, different providers. Each SendSmsHandler.execute under the
 * correct CLS tenant writes a SmsDelivery row carrying that org's id.
 * Cross-read returns no rows for the other tenant.
 */
describe('SaaS-02g-sms — send-sms tenant-scoped dispatch', () => {
  let h: IsolationHarness;
  let sendSms: SendSmsHandler;
  let factory: SmsProviderFactory;

  beforeAll(async () => {
    h = await bootHarness();
    sendSms = h.app.get(SendSmsHandler);
    factory = h.app.get(SmsProviderFactory);
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('send under org A writes SmsDelivery with organizationId=A; org B cannot read it', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`sms-send-a-${ts}`, 'إرسال أ');
    const b = await h.createOrg(`sms-send-b-${ts}`, 'إرسال ب');

    // Stub adapter so we don't actually hit the network.
    let idCounter = 0;
    jest.spyOn(factory, 'forCurrentTenant').mockImplementation(async () => ({
      name: 'UNIFONIC',
      send: async () => ({
        providerMessageId: `stub-${ts}-${++idCounter}`,
        status: 'SENT',
      }),
      verifyDlrSignature: () => undefined,
      parseDlr: () => ({
        providerMessageId: '',
        status: 'DELIVERED',
      }),
    }));

    const tagA = `hi-from-A-${ts}`;
    const tagB = `hi-from-B-${ts}`;

    await h.runAs({ organizationId: a.id }, () =>
      sendSms.execute({ phone: '+9665' + ts, body: tagA }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      sendSms.execute({ phone: '+9666' + ts, body: tagB }),
    );

    const fromA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.smsDelivery.findMany({ where: { body: tagA } }),
    );
    expect(fromA).toHaveLength(1);
    expect(fromA[0]?.organizationId).toBe(a.id);

    const fromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.smsDelivery.findMany({ where: { body: tagB } }),
    );
    expect(fromB).toHaveLength(1);
    expect(fromB[0]?.organizationId).toBe(b.id);

    // Cross-tenant read: from A's context, count rows tagged as B — must be 0.
    let crossCount = -1;
    await h.runAs({ organizationId: a.id }, async () => {
      crossCount = await h.prisma.smsDelivery.count({
        where: { body: tagB },
      });
    });
    expect(crossCount).toBe(0);
  });
});
