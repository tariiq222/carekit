import { ChargeDueSubscriptionsCron } from './charge-due-subscriptions.cron';

const buildConfig = (enabled: boolean) => ({
  get: jest.fn((key: string, defaultValue?: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    if (key === 'BACKEND_URL') return 'https://api.deqah.test';
    return defaultValue;
  }),
});

const makeMonthlyPlan = () => ({ priceMonthly: 199, priceAnnual: 1990 });
const makeAnnualPlan = () => ({ priceMonthly: 199, priceAnnual: 1990 });

const buildCls = () => ({
  run: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  set: jest.fn(),
});

const buildPrisma = (subs: unknown[] = []) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subs),
    },
    subscriptionInvoice: {
      create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
  },
});

const buildDeps = () => ({
  moyasar: {
    chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'paid' }),
  },
  recordPayment: {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  },
  recordFailure: {
    execute: jest.fn().mockResolvedValue({ ok: true }),
  },
});

const buildFlags = (planVersioningEnabled = false) => ({ planVersioningEnabled });

const buildCron = (
  prisma: ReturnType<typeof buildPrisma>,
  config: ReturnType<typeof buildConfig>,
  deps = buildDeps(),
  cls = buildCls(),
  flags = buildFlags(),
) =>
  new ChargeDueSubscriptionsCron(
    prisma as never,
    config as never,
    cls as never,
    deps.moyasar as never,
    deps.recordPayment as never,
    deps.recordFailure as never,
    flags as never,
  );

const PAST_DATE = new Date(Date.now() - 1000);

describe('ChargeDueSubscriptionsCron', () => {
  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma();
    const deps = buildDeps();
    const cron = buildCron(prisma, buildConfig(false), deps);
    await cron.execute();
    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
    expect(prisma.$allTenants.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(deps.moyasar.chargeWithToken).not.toHaveBeenCalled();
  });

  it('skips subscriptions not yet due (currentPeriodEnd > now)', async () => {
    const prisma = buildPrisma([]);
    const cron = buildCron(prisma, buildConfig(true));
    await cron.execute();
    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentPeriodEnd: expect.objectContaining({ lte: expect.any(Date) }),
          status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
        }),
      }),
    );
    expect(prisma.$allTenants.subscriptionInvoice.create).not.toHaveBeenCalled();
  });

  it('creates SubscriptionInvoice with DUE status for each due subscription', async () => {
    const sub = {
      id: 'sub-1',
      organizationId: 'org-1',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: null,
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    const cron = buildCron(prisma, buildConfig(true), deps);
    await cron.execute();

    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: 'sub-1',
          organizationId: 'org-1',
          status: 'DUE',
          flatAmount: 199,
          amount: 199,
          overageAmount: 0,
          billingCycle: 'MONTHLY',
        }),
      }),
    );
    expect(deps.moyasar.chargeWithToken).not.toHaveBeenCalled();
  });

  it('uses priceAnnual for ANNUAL billing cycle', async () => {
    const sub = {
      id: 'sub-2',
      organizationId: 'org-2',
      billingCycle: 'ANNUAL',
      currentPeriodStart: new Date('2025-04-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: null,
      plan: makeAnnualPlan(),
    };
    const prisma = buildPrisma([sub]);
    const cron = buildCron(prisma, buildConfig(true));
    await cron.execute();

    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flatAmount: 1990,
          amount: 1990,
          billingCycle: 'ANNUAL',
        }),
      }),
    );
  });

  it('uses priceMonthly for MONTHLY billing cycle', async () => {
    const sub = {
      id: 'sub-3',
      organizationId: 'org-3',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: null,
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const cron = buildCron(prisma, buildConfig(true));
    await cron.execute();

    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flatAmount: 199,
          billingCycle: 'MONTHLY',
        }),
      }),
    );
  });

  it('charges saved Moyasar card token and records paid invoices', async () => {
    const sub = {
      id: 'sub-paid',
      organizationId: 'org-paid',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: 'tok_saved',
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    const cron = buildCron(prisma, buildConfig(true), deps);

    await cron.execute();

    expect(deps.moyasar.chargeWithToken).toHaveBeenCalledWith({
      token: 'tok_saved',
      amount: 19_900,
      currency: 'SAR',
      idempotencyKey: 'subscription-invoice:inv-1',
      description: 'Deqah subscription invoice inv-1',
      callbackUrl: 'https://api.deqah.test/api/v1/public/billing/webhooks/moyasar',
    });
    expect(deps.recordPayment.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'pay-1',
    });
    expect(deps.recordFailure.execute).not.toHaveBeenCalled();
  });

  it('records failed Moyasar statuses without marking the invoice paid', async () => {
    const sub = {
      id: 'sub-failed',
      organizationId: 'org-failed',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: 'tok_saved',
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    deps.moyasar.chargeWithToken.mockResolvedValue({ id: 'pay-2', status: 'failed' });
    const cron = buildCron(prisma, buildConfig(true), deps);

    await cron.execute();

    expect(deps.recordPayment.execute).not.toHaveBeenCalled();
    expect(deps.recordFailure.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'pay-2',
      reason: 'Moyasar returned status failed',
    });
  });

  // Bug B2 — belt-and-suspenders: even if `currentPeriodEnd` somehow stayed
  // stale, the cron must skip subscriptions that just paid in the last 24h.
  it('skips subscriptions whose lastPaymentAt is within the last 24 hours', async () => {
    const prisma = buildPrisma([]);
    const cron = buildCron(prisma, buildConfig(true));
    await cron.execute();
    const whereArg = (prisma.$allTenants.subscription.findMany.mock.calls[0][0] as { where: unknown }).where;
    expect(whereArg).toEqual(
      expect.objectContaining({
        OR: [
          { lastPaymentAt: null },
          { lastPaymentAt: { lt: expect.any(Date) } },
        ],
      }),
    );
  });

  it('orders due subscriptions by currentPeriodEnd ascending (oldest first)', async () => {
    const prisma = buildPrisma([]);
    const cron = buildCron(prisma, buildConfig(true));
    await cron.execute();
    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { currentPeriodEnd: 'asc' },
      }),
    );
  });

  it('finds zero due subscriptions when re-run minutes after a successful charge', async () => {
    // Simulate the post-charge state: a subscription whose `lastPaymentAt`
    // is 5 min ago and `currentPeriodEnd` is in the future. Even if it
    // somehow re-appeared in the candidate set, the OR filter must
    // exclude it. We emulate Prisma `findMany`'s where evaluation manually.
    const justPaidSub = {
      id: 'sub-just-paid',
      organizationId: 'org-just-paid',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(Date.now() - 60_000),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      moyasarCardTokenRef: 'tok_saved',
      lastPaymentAt: new Date(Date.now() - 5 * 60_000),
      plan: makeMonthlyPlan(),
    };
    const prisma = {
      $allTenants: {
        subscription: {
          findMany: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
            const periodEnd = where.currentPeriodEnd as { lte: Date };
            const orClauses = where.OR as Array<Record<string, unknown>> | undefined;
            const candidates = [justPaidSub];
            return Promise.resolve(
              candidates.filter((s) => {
                if (s.currentPeriodEnd > periodEnd.lte) return false;
                if (!orClauses) return true;
                return orClauses.some((c) => {
                  if ('lastPaymentAt' in c && c.lastPaymentAt === null) {
                    return s.lastPaymentAt === null;
                  }
                  if (
                    'lastPaymentAt' in c &&
                    typeof c.lastPaymentAt === 'object' &&
                    c.lastPaymentAt !== null &&
                    'lt' in (c.lastPaymentAt as Record<string, unknown>)
                  ) {
                    const cutoff = (c.lastPaymentAt as { lt: Date }).lt;
                    return s.lastPaymentAt !== null && s.lastPaymentAt < cutoff;
                  }
                  return false;
                });
              }),
            );
          }),
        },
        subscriptionInvoice: { create: jest.fn() },
      },
    };
    const deps = buildDeps();
    const cron = buildCron(prisma as never, buildConfig(true), deps);
    await cron.execute();
    // No invoice created, no Moyasar charge — the second cron tick is a no-op.
    expect(prisma.$allTenants.subscriptionInvoice.create).not.toHaveBeenCalled();
    expect(deps.moyasar.chargeWithToken).not.toHaveBeenCalled();
    expect(deps.recordPayment.execute).not.toHaveBeenCalled();
  });

  it('records charge exceptions as payment failures', async () => {
    const sub = {
      id: 'sub-error',
      organizationId: 'org-error',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: 'tok_saved',
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    deps.moyasar.chargeWithToken.mockRejectedValue(new Error('network timeout'));
    const cron = buildCron(prisma, buildConfig(true), deps);

    await cron.execute();

    expect(deps.recordPayment.execute).not.toHaveBeenCalled();
    expect(deps.recordFailure.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'unavailable',
      reason: 'network timeout',
    });
  });

  it('uses planVersion price when flag on (legacy plan price changed but sub keeps old)', async () => {
    // planVersion has 99/month, live plan has 199/month; flag on → uses 99
    const sub = {
      id: 'sub-versioned',
      organizationId: 'org-versioned',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: 'tok_versioned',
      plan: { priceMonthly: 199, priceAnnual: 1990 },
      planVersion: { priceMonthly: 99, priceAnnual: 990 },
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    const cron = buildCron(prisma, buildConfig(true), deps, buildCls(), buildFlags(true));

    await cron.execute();

    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ flatAmount: 99, amount: 99 }),
      }),
    );
  });

  it('falls back to live plan when flag off', async () => {
    const sub = {
      id: 'sub-live',
      organizationId: 'org-live',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      moyasarCardTokenRef: null,
      plan: { priceMonthly: 199, priceAnnual: 1990 },
      planVersion: { priceMonthly: 99, priceAnnual: 990 },
    };
    const prisma = buildPrisma([sub]);
    const deps = buildDeps();
    const cron = buildCron(prisma, buildConfig(true), deps, buildCls(), buildFlags(false));

    await cron.execute();

    // flag off → uses live plan price (199)
    expect(prisma.$allTenants.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ flatAmount: 199, amount: 199 }),
      }),
    );
  });
});
