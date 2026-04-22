import { createHmac } from 'crypto';
import { bootHarness, IsolationHarness } from '../../tenant-isolation/isolation-harness';
import { SmsDlrHandler } from '../../../src/modules/comms/sms-dlr/sms-dlr.handler';
import { SmsCredentialsService } from '../../../src/infrastructure/sms/sms-credentials.service';

/**
 * SaaS-02g-sms §11 — DLR webhook tenant isolation.
 *
 * Two orgs with pending SmsDelivery rows. DLR posted for org A only updates
 * org A's row. DLR signed for org A but rerouted to org B (path mismatch) is
 * rejected / no-ops.
 */
describe('SaaS-02g-sms — DLR webhook tenant context', () => {
  let h: IsolationHarness;
  let dlr: SmsDlrHandler;
  let credentials: SmsCredentialsService;

  beforeAll(async () => {
    h = await bootHarness();
    dlr = h.app.get(SmsDlrHandler);
    credentials = h.app.get(SmsCredentialsService);
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('DLR for org A updates only org A SmsDelivery row', async () => {
    const ts = Date.now();
    const a = await h.createOrg(`dlr-a-${ts}`, 'تسليم أ');
    const b = await h.createOrg(`dlr-b-${ts}`, 'تسليم ب');

    const ciphertextA = credentials.encrypt(
      { appSid: 'sid-a', apiKey: 'key-a' },
      a.id,
    );
    const ciphertextB = credentials.encrypt(
      { appSid: 'sid-b', apiKey: 'key-b' },
      b.id,
    );

    const webhookSecretA = 'wh-secret-a';
    const webhookSecretB = 'wh-secret-b';

    // Configure each org's SMS config (direct DB to bypass dashboard).
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: a.id },
        update: {
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextA,
          webhookSecret: webhookSecretA,
        },
        create: {
          organizationId: a.id,
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextA,
          webhookSecret: webhookSecretA,
        },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: b.id },
        update: {
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextB,
          webhookSecret: webhookSecretB,
        },
        create: {
          organizationId: b.id,
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextB,
          webhookSecret: webhookSecretB,
        },
      }),
    );

    // Seed pending SmsDelivery rows in each org with distinct providerMessageIds.
    const midA = `mid-a-${ts}`;
    const midB = `mid-b-${ts}`;
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.smsDelivery.create({
        data: {
          organizationId: a.id,
          provider: 'UNIFONIC',
          toPhone: '+9665',
          body: 'A',
          bodyHash: 'h-a',
          status: 'SENT',
          providerMessageId: midA,
        },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.smsDelivery.create({
        data: {
          organizationId: b.id,
          provider: 'UNIFONIC',
          toPhone: '+9666',
          body: 'B',
          bodyHash: 'h-b',
          status: 'SENT',
          providerMessageId: midB,
        },
      }),
    );

    // Valid DLR for org A.
    const rawA = JSON.stringify({ messageId: midA, status: 'delivered' });
    const sigA = createHmac('sha256', webhookSecretA).update(rawA).digest('hex');
    await dlr.execute({
      provider: 'UNIFONIC',
      organizationId: a.id,
      rawBody: rawA,
      signature: sigA,
    });

    const updatedA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.smsDelivery.findFirst({
        where: { providerMessageId: midA },
      }),
    );
    expect(updatedA?.status).toBe('DELIVERED');

    const notUpdatedB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.smsDelivery.findFirst({
        where: { providerMessageId: midB },
      }),
    );
    expect(notUpdatedB?.status).toBe('SENT');
  });

  it('DLR signed with org A secret is rejected when posted to org B path', async () => {
    const ts = Date.now() + 1;
    const a = await h.createOrg(`dlr-xa-${ts}`, 'X تسليم أ');
    const b = await h.createOrg(`dlr-xb-${ts}`, 'X تسليم ب');

    const ciphertextA = credentials.encrypt(
      { appSid: 'sid-a', apiKey: 'key-a' },
      a.id,
    );
    const ciphertextB = credentials.encrypt(
      { appSid: 'sid-b', apiKey: 'key-b' },
      b.id,
    );
    const secretA = 'secret-a-xa';
    const secretB = 'secret-b-xb';

    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: a.id },
        update: {
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextA,
          webhookSecret: secretA,
        },
        create: {
          organizationId: a.id,
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextA,
          webhookSecret: secretA,
        },
      }),
    );
    await h.runAs({ organizationId: b.id }, () =>
      h.prisma.organizationSmsConfig.upsert({
        where: { organizationId: b.id },
        update: {
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextB,
          webhookSecret: secretB,
        },
        create: {
          organizationId: b.id,
          provider: 'UNIFONIC',
          credentialsCiphertext: ciphertextB,
          webhookSecret: secretB,
        },
      }),
    );

    const raw = JSON.stringify({ messageId: 'any', status: 'delivered' });
    const sigSignedByA = createHmac('sha256', secretA).update(raw).digest('hex');

    await expect(
      dlr.execute({
        provider: 'UNIFONIC',
        organizationId: b.id,
        rawBody: raw,
        signature: sigSignedByA,
      }),
    ).rejects.toThrow(/signature/);
  });
});
