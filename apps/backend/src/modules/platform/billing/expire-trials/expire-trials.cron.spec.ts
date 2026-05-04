import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
import { ExpireTrialsCron } from './expire-trials.cron';

const NOW = new Date('2026-05-01T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

type TrialSubscriptionFixture = {
  id: string;
  organizationId: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  notifiedTrialEndingAt: Date | null;
  moyasarCardTokenRef: string | null;
  organization: { nameAr: string };
  plan: {
    priceMonthly: number;
    priceAnnual: number;
  };
};

const buildConfig = (enabled: boolean) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    if (key === 'PLATFORM_DASHBOARD_URL') return 'https://app.webvue.pro/dashboard';
    return def;
  }),
});

const buildMailer = () => ({
  sendTrialEnding: jest.fn().mockResolvedValue(undefined),
  sendTrialExpired: jest.fn().mockResolvedValue(undefined),
  sendTrialDay7Reminder: jest.fn().mockResolvedValue(undefined),
  sendTrialDay3Warning: jest.fn().mockResolvedValue(undefined),
  sendTrialDay1Final: jest.fn().mockResolvedValue(undefined),
  sendTrialSuspendedNoCard: jest.fn().mockResolvedValue(undefined),
});

const makeSub = (
  patch: Partial<TrialSubscriptionFixture> = {},
): TrialSubscriptionFixture => ({
  id: 'sub-1',
  organizationId: 'org-1',
  billingCycle: 'MONTHLY',
  currentPeriodStart: new Date('2026-04-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-05-01T00:00:00.000Z'),
  trialEndsAt: new Date(NOW.getTime() + 7 * DAY_MS),
  notifiedTrialEndingAt: null,
  moyasarCardTokenRef: null,
  organization: { nameAr: 'Org 1' },
  plan: { priceMonthly: 299, priceAnnual: 2990 },
  ...patch,
});

const buildPrisma = ({
  reminderSubs = [],
  expiredSubs = [],
}: {
  reminderSubs?: TrialSubscriptionFixture[];
  expiredSubs?: TrialSubscriptionFixture[];
} = {}) => {
  const subscriptionUpdate = jest.fn().mockResolvedValue({});
  const organizationUpdate = jest.fn().mockResolvedValue({});
  const invoiceCreate = jest.fn().mockResolvedValue({ id: 'inv-1' });
  const orgUpdate = jest.fn().mockResolvedValue({});
  const txSubscriptionUpdate = jest.fn().mockResolvedValue({});
  const txOrgUpdate = jest.fn().mockResolvedValue({});

  const allTenantsMock = {
    subscription: {
      findMany: jest.fn().mockImplementation((args: { where?: { trialEndsAt?: { gt?: Date; lte?: Date } } }) => {
        if (args.where?.trialEndsAt?.gt) return Promise.resolve(reminderSubs);
        if (args.where?.trialEndsAt?.lte) return Promise.resolve(expiredSubs);
        return Promise.resolve([]);
      }),
      update: subscriptionUpdate,
    },
    subscriptionInvoice: {
      create: invoiceCreate,
    },
    organization: {
      update: organizationUpdate,
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        user: { email: 'owner@example.com', name: 'Owner' },
      }),
    },
    cronHeartbeat: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(
      async (
        fn: (tx: {
          organization: { update: typeof txOrgUpdate };
          subscription: { update: typeof txSubscriptionUpdate };
        }) => Promise<unknown>,
      ) =>
        fn({
          organization: { update: txOrgUpdate },
          subscription: { update: txSubscriptionUpdate },
        }),
    ),
  };

  return {
    organization: {
      update: orgUpdate,
    },
    $allTenants: allTenantsMock,
    __tx: {
      organizationUpdate: txOrgUpdate,
      subscriptionUpdate: txSubscriptionUpdate,
    },
    __allTenants: {
      organizationUpdate,
      invoiceCreate,
    },
  };
};

const buildCache = () => ({ invalidate: jest.fn() });

const buildCls = () => ({
  run: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  set: jest.fn(),
});

type CronDeps = {
  enabled?: boolean;
  cache?: ReturnType<typeof buildCache>;
  mailer?: ReturnType<typeof buildMailer>;
  moyasar?: unknown;
  recordPayment?: unknown;
  recordFailure?: unknown;
  cls?: ReturnType<typeof buildCls>;
};

function buildCron(prisma: ReturnType<typeof buildPrisma>, deps: CronDeps = {}) {
  const {
    enabled = true,
    cache = buildCache(),
    mailer = buildMailer(),
    moyasar,
    recordPayment,
    recordFailure,
    cls = buildCls(),
  } = deps;
  return new ExpireTrialsCron(
    prisma as never,
    buildConfig(enabled) as never,
    cache as never,
    mailer as never,
    moyasar as never,
    recordPayment as never,
    recordFailure as never,
    cls as never,
  );
}

describe('ExpireTrialsCron', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma({ expiredSubs: [makeSub()] });
    const cron = buildCron(prisma, { enabled: false });

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no trial reminders or expirations are due', async () => {
    const prisma = buildPrisma();
    const mailer = buildMailer();
    const cron = buildCron(prisma, { mailer });

    await cron.execute();

    expect(prisma.__tx.organizationUpdate).not.toHaveBeenCalled();
    expect(prisma.__tx.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mailer.sendTrialDay7Reminder).not.toHaveBeenCalled();
  });

  it('sends the day-7 trial reminder and records the notification timestamp', async () => {
    const sub = makeSub({ trialEndsAt: new Date(NOW.getTime() + 7 * DAY_MS) });
    const prisma = buildPrisma({ reminderSubs: [sub] });
    const mailer = buildMailer();
    const cron = buildCron(prisma, { mailer });

    await cron.execute();

    expect(mailer.sendTrialDay7Reminder).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ orgName: 'Org 1', daysLeft: 7 }),
    );
    expect(prisma.$allTenants.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { notifiedTrialEndingAt: NOW },
    });
  });

  it('sends the day-3 warning after a prior day-7 reminder', async () => {
    const sub = makeSub({
      trialEndsAt: new Date(NOW.getTime() + 3 * DAY_MS),
      notifiedTrialEndingAt: new Date(NOW.getTime() - 4 * DAY_MS),
    });
    const prisma = buildPrisma({ reminderSubs: [sub] });
    const mailer = buildMailer();
    const cron = buildCron(prisma, { mailer });

    await cron.execute();

    expect(mailer.sendTrialDay3Warning).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ orgName: 'Org 1', daysLeft: 3 }),
    );
  });

  it('does not resend the same trial reminder milestone twice', async () => {
    const sub = makeSub({
      trialEndsAt: new Date(NOW.getTime() + 3 * DAY_MS),
      notifiedTrialEndingAt: NOW,
    });
    const prisma = buildPrisma({ reminderSubs: [sub] });
    const mailer = buildMailer();
    const cron = buildCron(prisma, { mailer });

    await cron.execute();

    expect(mailer.sendTrialDay3Warning).not.toHaveBeenCalled();
    expect(prisma.$allTenants.subscription.update).not.toHaveBeenCalled();
  });

  it('suspends expired TRIALING subscriptions with no saved card', async () => {
    const expired = makeSub({
      trialEndsAt: new Date(NOW.getTime() - DAY_MS),
      moyasarCardTokenRef: null,
    });
    const prisma = buildPrisma({ expiredSubs: [expired] });
    const mailer = buildMailer();
    const cache = buildCache();
    const cron = buildCron(prisma, { cache, mailer });

    await cron.execute();

    expect(prisma.__tx.organizationUpdate).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: {
        status: 'SUSPENDED',
        suspendedAt: NOW,
        suspendedReason: 'TRIAL_EXPIRED_NO_CARD',
      },
    });
    expect(prisma.__tx.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        status: 'SUSPENDED',
        pastDueSince: null,
        lastFailureReason: 'Trial ended without a saved payment method',
      }),
    });
    expect(cache.invalidate).toHaveBeenCalledWith('org-1');
    expect(mailer.sendTrialSuspendedNoCard).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ orgName: 'Org 1' }),
    );
  });

  it('charges an expired trial with a saved card and marks the organization ACTIVE on success', async () => {
    const expired = makeSub({
      trialEndsAt: new Date(NOW.getTime() - DAY_MS),
      moyasarCardTokenRef: 'tok_123',
    });
    const prisma = buildPrisma({ expiredSubs: [expired] });
    const moyasar = {
      chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'paid' }),
    };
    const recordPayment = { execute: jest.fn().mockResolvedValue({ ok: true }) };
    const recordFailure = { execute: jest.fn().mockResolvedValue({ ok: true }) };
    const cron = buildCron(prisma, { moyasar, recordPayment, recordFailure });

    await cron.execute();

    expect(prisma.__allTenants.invoiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: 'sub-1',
          organizationId: 'org-1',
          amount: 299,
          status: 'DUE',
        }),
      }),
    );
    expect(moyasar.chargeWithToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'tok_123',
        amount: 29_900,
        idempotencyKey: 'trial-conversion:inv-1',
      }),
    );
    expect(recordPayment.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'pay-1',
    });
    expect(recordFailure.execute).not.toHaveBeenCalled();
    expect(prisma.__allTenants.organizationUpdate).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
    });
  });

  it('records a failed trial conversion charge and marks the organization PAST_DUE', async () => {
    const expired = makeSub({
      trialEndsAt: new Date(NOW.getTime() - DAY_MS),
      moyasarCardTokenRef: 'tok_123',
    });
    const prisma = buildPrisma({ expiredSubs: [expired] });
    const moyasar = {
      chargeWithToken: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'failed' }),
    };
    const recordPayment = { execute: jest.fn().mockResolvedValue({ ok: true }) };
    const recordFailure = { execute: jest.fn().mockResolvedValue({ ok: true }) };
    const cron = buildCron(prisma, { moyasar, recordPayment, recordFailure });

    await cron.execute();

    expect(recordPayment.execute).not.toHaveBeenCalled();
    expect(recordFailure.execute).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      moyasarPaymentId: 'pay-1',
      reason: 'Moyasar returned status failed',
    });
    expect(prisma.__allTenants.organizationUpdate).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { status: 'PAST_DUE' },
    });
  });

  it('wraps execute body in super-admin CLS context', async () => {
    const prisma = buildPrisma();
    const cls = buildCls();
    const cron = buildCron(prisma, { cls });

    await cron.execute();

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  });
});
