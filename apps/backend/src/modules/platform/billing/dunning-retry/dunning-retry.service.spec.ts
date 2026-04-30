import { DunningRetryService } from './dunning-retry.service';

const NOW = new Date('2026-04-30T12:00:00.000Z');

const buildPrisma = () => ({
  savedCard: {
    findFirst: jest.fn().mockResolvedValue({
      id: 'card-1',
      moyasarTokenId: 'token_default',
    }),
  },
  dunningLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    update: jest.fn().mockResolvedValue({}),
  },
  subscription: {
    update: jest.fn().mockResolvedValue({}),
  },
  $allTenants: {
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        user: { email: 'owner@example.com', name: 'Owner' },
        organization: { nameAr: 'Org AR' },
      }),
    },
  },
});

const buildMoyasar = () => ({
  chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'paid' }),
});

const buildRecordPayment = () => ({
  execute: jest.fn().mockResolvedValue({ ok: true }),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildConfig = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'BACKEND_URL') return 'https://api.deqah.test';
    if (key === 'PLATFORM_DASHBOARD_URL') return 'https://app.deqah.test';
    return fallback;
  }),
});

const buildMailer = () => ({
  sendDunningRetry: jest.fn().mockResolvedValue(undefined),
});

const buildService = (
  prisma = buildPrisma(),
  moyasar = buildMoyasar(),
  recordPayment = buildRecordPayment(),
  cache = buildCache(),
  config = buildConfig(),
  mailer = buildMailer(),
) =>
  new DunningRetryService(
    prisma as never,
    moyasar as never,
    recordPayment as never,
    cache as never,
    config as never,
    mailer as never,
  );

const subscription = {
  id: 'sub-1',
  organizationId: 'org-1',
  dunningRetryCount: 0,
};

const invoice = {
  id: 'inv-1',
  amount: 299,
};

describe('DunningRetryService', () => {
  it('re-resolves the current default saved card for every retry', async () => {
    const prisma = buildPrisma();
    const service = buildService(prisma);

    await service.retryInvoice({ subscription, invoice, now: NOW, manual: false });

    expect(prisma.savedCard.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isDefault: true },
      select: { id: true, moyasarTokenId: true },
    });
  });

  it('charges Moyasar with invoice and attempt idempotency', async () => {
    const moyasar = buildMoyasar();
    const service = buildService(buildPrisma(), moyasar);

    await service.retryInvoice({ subscription, invoice, now: NOW, manual: false });

    expect(moyasar.chargeWithToken).toHaveBeenCalledWith({
      token: 'token_default',
      amount: 29_900,
      currency: 'SAR',
      idempotencyKey: 'dunning:inv-1:1',
      givenId: 'dunning:inv-1:1',
      description: 'Deqah dunning retry 1 for invoice inv-1',
      callbackUrl: 'https://api.deqah.test/api/v1/public/billing/webhooks/moyasar',
    });
  });

  it('does not charge when the same invoice attempt is already being processed', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    prisma.dunningLog.create.mockRejectedValue({ code: 'P2002' });
    const service = buildService(prisma, moyasar);

    await expect(
      service.retryInvoice({ subscription, invoice, now: NOW, manual: false }),
    ).resolves.toEqual({ ok: false, status: 'DUPLICATE_ATTEMPT', attemptNumber: 1 });

    expect(moyasar.chargeWithToken).not.toHaveBeenCalled();
  });

  it('records paid attempts and delegates invoice recovery', async () => {
    const prisma = buildPrisma();
    const recordPayment = buildRecordPayment();
    const cache = buildCache();
    const service = buildService(prisma, buildMoyasar(), recordPayment, cache);

    await expect(
      service.retryInvoice({ subscription, invoice, now: NOW, manual: true }),
    ).resolves.toEqual({ ok: true, status: 'PAID', attemptNumber: 1 });

    expect(prisma.dunningLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: {
        status: 'PAID',
        moyasarPaymentId: 'pay-1',
        failureReason: null,
        executedAt: NOW,
      },
    });
    expect(recordPayment.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'pay-1',
    });
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        organizationId: 'org-1',
        dunningRetryCount: 0,
        nextRetryAt: null,
        lastFailureReason: null,
      },
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
  });

  it('treats initiated 3DS status as a failed retry', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    moyasar.chargeWithToken.mockResolvedValue({
      id: 'pay-3ds',
      status: 'initiated',
      transactionUrl: 'https://3ds.test',
    });
    const service = buildService(prisma, moyasar);

    await expect(
      service.retryInvoice({ subscription, invoice, now: NOW, manual: false }),
    ).resolves.toEqual({ ok: false, status: 'FAILED', attemptNumber: 1 });

    expect(prisma.dunningLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        moyasarPaymentId: 'pay-3ds',
        failureReason: 'Moyasar returned status initiated',
      }),
    });
  });

  it('sends a dunning retry email after failed attempts', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    moyasar.chargeWithToken.mockResolvedValue({ id: 'pay-failed', status: 'failed' });
    const mailer = buildMailer();
    const service = buildService(prisma, moyasar, buildRecordPayment(), buildCache(), buildConfig(), mailer);

    await service.retryInvoice({ subscription, invoice, now: NOW, manual: false });

    expect(mailer.sendDunningRetry).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({
        ownerName: 'Owner',
        orgName: 'Org AR',
        amountSar: '299.00',
        attemptNumber: 1,
        maxAttempts: 4,
        reason: 'Moyasar returned status failed',
        billingUrl: 'https://app.deqah.test/settings/billing',
      }),
    );
  });

  it('keeps dunning state updates independent from owner email lookup failures', async () => {
    const prisma = buildPrisma();
    prisma.$allTenants.membership.findFirst.mockRejectedValue(new Error('mail lookup failed'));
    const moyasar = buildMoyasar();
    moyasar.chargeWithToken.mockResolvedValue({ id: 'pay-failed', status: 'failed' });
    const service = buildService(prisma, moyasar);

    await expect(
      service.retryInvoice({ subscription, invoice, now: NOW, manual: false }),
    ).resolves.toEqual({ ok: false, status: 'FAILED', attemptNumber: 1 });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        organizationId: 'org-1',
        dunningRetryCount: 1,
        nextRetryAt: new Date('2026-05-01T12:00:00.000Z'),
        lastFailureReason: 'Moyasar returned status failed',
      },
    });
  });

  it('logs no-card attempts and schedules the next retry', async () => {
    const prisma = buildPrisma();
    prisma.savedCard.findFirst.mockResolvedValue(null);
    const moyasar = buildMoyasar();
    const service = buildService(prisma, moyasar);

    await service.retryInvoice({ subscription, invoice, now: NOW, manual: false });

    expect(moyasar.chargeWithToken).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        organizationId: 'org-1',
        dunningRetryCount: 1,
        nextRetryAt: new Date('2026-05-01T12:00:00.000Z'),
        lastFailureReason: 'No default saved card',
      },
    });
  });

  it('suspends after the fourth failed retry', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    moyasar.chargeWithToken.mockResolvedValue({ id: 'pay-4', status: 'failed' });
    const service = buildService(prisma, moyasar);

    await service.retryInvoice({
      subscription: { ...subscription, dunningRetryCount: 3 },
      invoice,
      now: NOW,
      manual: false,
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        organizationId: 'org-1',
        status: 'SUSPENDED',
        dunningRetryCount: 4,
        nextRetryAt: null,
        lastFailureReason: 'Moyasar returned status failed',
      },
    });
  });
});
