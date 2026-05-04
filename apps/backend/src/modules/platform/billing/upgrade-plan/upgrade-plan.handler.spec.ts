import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UpgradePlanHandler } from './upgrade-plan.handler';
import { SubscriptionStateMachine } from '../subscription-state-machine';

const periodStart = new Date('2026-04-01T00:00:00.000Z');
const periodEnd = new Date('2026-05-01T00:00:00.000Z');

const basicPlan = {
  id: 'plan-1',
  slug: 'basic',
  nameAr: 'أساسي',
  priceMonthly: '300.00',
  priceAnnual: '3000.00',
};
const proPlan = {
  id: 'plan-2',
  slug: 'pro',
  nameAr: 'احترافي',
  priceMonthly: '900.00',
  priceAnnual: '9000.00',
  isActive: true,
};

// Plans matching the bug report: BASIC 249.92/mo (2999/yr), PRO 799/mo
const bugReportBasicPlan = {
  id: 'plan-basic-bug',
  nameAr: 'أساسي',
  priceMonthly: '299.00',
  priceAnnual: '2999.00',
};
const bugReportProPlan = {
  id: 'plan-pro-bug',
  nameAr: 'احترافي',
  priceMonthly: '799.00',
  priceAnnual: '7999.00',
  isActive: true,
};

const buildPrisma = () => ({
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  plan: {
    findFirst: jest.fn(),
  },
  planVersion: {
    findFirst: jest.fn().mockResolvedValue({ id: 'pv-latest' }),
  },
  subscriptionInvoice: {
    create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    update: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'PAID' }),
  },
  membership: {
    findFirst: jest.fn().mockResolvedValue({
      user: { email: 'owner@example.com', name: 'Owner' },
      organization: { nameAr: 'Org AR' },
    }),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationId: jest.fn().mockReturnValue(organizationId),
});

const buildCache = () => ({
  invalidate: jest.fn(),
});

const buildMailer = () => ({
  sendPlanChanged: jest.fn().mockResolvedValue(undefined),
});

const buildConfig = () => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BACKEND_URL') return 'https://api.deqah.test';
    return def;
  }),
});

const buildMoyasar = () => ({
  chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'paid' }),
});

const activeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  organizationId: 'org-A',
  status: 'ACTIVE',
  billingCycle: 'MONTHLY',
  currentPeriodStart: periodStart,
  currentPeriodEnd: periodEnd,
  cancelAtPeriodEnd: false,
  scheduledPlanId: null,
  scheduledBillingCycle: null,
  scheduledPlanChangeAt: null,
  moyasarCardTokenRef: 'tok_legacy',
  defaultSavedCard: { id: 'card-1', moyasarTokenId: 'tok_default' },
  plan: basicPlan,
  ...overrides,
});

const buildEventBus = () => ({
  publish: jest.fn().mockResolvedValue(undefined),
});

const buildFlags = (planVersioningEnabled = false) => ({ planVersioningEnabled });

const buildHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  cache = buildCache(),
  mailer = buildMailer(),
  moyasar = buildMoyasar(),
  flags = buildFlags(),
) =>
  new UpgradePlanHandler(
    prisma as never,
    buildTenant('org-A') as never,
    cache as never,
    new SubscriptionStateMachine(),
    mailer as never,
    moyasar as never,
    buildConfig() as never,
    buildEventBus() as never,
    flags as never,
  );

describe('UpgradePlanHandler', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-16T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws NotFoundException when no subscription exists', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(NotFoundException);
  });

  it.each(['CANCELED', 'SUSPENDED'])('throws BadRequestException for %s subscription', async (status) => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription({ status }));
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when target plan is not an upgrade', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription({ plan: proPlan }));
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow('Target plan is not an upgrade');
  });

  it('requires a default saved card or legacy Moyasar card token', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(
      activeSubscription({ moyasarCardTokenRef: null, defaultSavedCard: null }),
    );
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('creates a proration invoice with a PRORATION line item', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription());
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma);

    await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: 'sub-1',
        organizationId: 'org-A',
        amount: '300.00',
        flatAmount: '0.00',
        overageAmount: '0.00',
        status: 'DUE',
        lineItems: [
          expect.objectContaining({
            kind: 'PRORATION',
            amount: '300.00',
            amountHalalas: 30000,
          }),
        ],
      }),
    });
  });

  it('charges Moyasar with integer halalas and a givenId', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription());
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma, buildCache(), buildMailer(), moyasar);

    await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    expect(moyasar.chargeWithToken).toHaveBeenCalledWith({
      token: 'tok_default',
      amount: 30000,
      currency: 'SAR',
      idempotencyKey: 'subscription-proration:inv-1',
      givenId: 'subscription-proration:inv-1',
      description: 'Deqah subscription proration invoice inv-1',
      callbackUrl: 'https://api.deqah.test/api/v1/public/billing/webhooks/moyasar',
    });
  });

  it('rejects non-paid Moyasar statuses without updating the subscription', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    moyasar.chargeWithToken.mockResolvedValue({ id: 'pay-3ds', status: 'initiated' });
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription());
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    const handler = buildHandler(prisma, buildCache(), buildMailer(), moyasar);

    await expect(
      handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.subscriptionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        moyasarPaymentId: 'pay-3ds',
      }),
    });
  });

  it('updates subscription, clears scheduled changes, records payment, invalidates cache, and emails owner', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    const mailer = buildMailer();
    prisma.subscription.findFirst.mockResolvedValue(
      activeSubscription({
        cancelAtPeriodEnd: true,
        scheduledPlanId: 'plan-old',
        scheduledBillingCycle: 'MONTHLY',
        scheduledPlanChangeAt: periodEnd,
      }),
    );
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-2' });
    const handler = buildHandler(prisma, cache, mailer);

    const result = await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        planId: 'plan-2',
        billingCycle: 'MONTHLY',
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
      }),
    });
    expect(prisma.subscriptionInvoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({
        status: 'PAID',
        paidAt: expect.any(Date),
        moyasarPaymentId: 'pay-1',
      }),
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(mailer.sendPlanChanged).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ fromPlanName: 'أساسي', toPlanName: 'احترافي' }),
    );
    expect(result).toEqual({ id: 'sub-1', planId: 'plan-2' });
  });

  it('does not throw for ANNUAL BASIC → MONTHLY PRO (the cross-cycle upgrade bug case)', async () => {
    // Bug: old code compared 2999 (annual) vs 799 (monthly) and wrongly threw 'not an upgrade'.
    // Fix: monthly-equivalent of BASIC annual = 2999/12 ≈ 249.92 < 799 → valid upgrade.
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    prisma.subscription.findFirst.mockResolvedValue(
      activeSubscription({ billingCycle: 'ANNUAL', plan: bugReportBasicPlan }),
    );
    prisma.plan.findFirst.mockResolvedValue(bugReportProPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-pro-bug' });
    const handler = buildHandler(prisma, buildCache(), buildMailer(), moyasar);

    await expect(
      handler.execute({ planId: 'plan-pro-bug', billingCycle: 'MONTHLY' }),
    ).resolves.toBeDefined();
    // Moyasar should have been charged (proration amount > 0)
    expect(moyasar.chargeWithToken).toHaveBeenCalled();
  });

  it('changes trial plans immediately without charging or requiring a card', async () => {
    const prisma = buildPrisma();
    const cache = buildCache();
    const mailer = buildMailer();
    const moyasar = buildMoyasar();
    prisma.subscription.findFirst.mockResolvedValue(
      activeSubscription({
        status: 'TRIALING',
        plan: proPlan,
        moyasarCardTokenRef: null,
        defaultSavedCard: null,
      }),
    );
    prisma.plan.findFirst.mockResolvedValue(basicPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-1' });
    const handler = buildHandler(prisma, cache, mailer, moyasar);

    const result = await handler.execute({ planId: 'plan-1', billingCycle: 'MONTHLY' });

    expect(prisma.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(moyasar.chargeWithToken).not.toHaveBeenCalled();
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        planId: 'plan-1',
        billingCycle: 'MONTHLY',
        cancelAtPeriodEnd: false,
        scheduledCancellationDate: null,
        scheduledPlanId: null,
        scheduledBillingCycle: null,
        scheduledPlanChangeAt: null,
      }),
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-A');
    expect(mailer.sendPlanChanged).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ fromPlanName: 'احترافي', toPlanName: 'أساسي' }),
    );
    expect(result).toEqual({ id: 'sub-1', planId: 'plan-1' });
  });

  it('snapshots planVersionId of latest version when flag on', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription());
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    prisma.planVersion.findFirst.mockResolvedValue({ id: 'pv-upgrade' });
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-2' });
    const handler = buildHandler(prisma, buildCache(), buildMailer(), buildMoyasar(), buildFlags(true));

    await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    const updateCall = prisma.subscription.update.mock.calls[0][0];
    expect(updateCall.data.planVersionId).toBe('pv-upgrade');
  });

  it('omits planVersionId when flag off (legacy)', async () => {
    const prisma = buildPrisma();
    prisma.subscription.findFirst.mockResolvedValue(activeSubscription());
    prisma.plan.findFirst.mockResolvedValue(proPlan);
    prisma.subscription.update.mockResolvedValue({ id: 'sub-1', planId: 'plan-2' });
    const handler = buildHandler(prisma, buildCache(), buildMailer(), buildMoyasar(), buildFlags(false));

    await handler.execute({ planId: 'plan-2', billingCycle: 'MONTHLY' });

    const updateCall = prisma.subscription.update.mock.calls[0][0];
    expect(updateCall.data.planVersionId).toBeNull();
    expect(prisma.planVersion.findFirst).not.toHaveBeenCalled();
  });
});
