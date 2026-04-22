import { ChargeDueSubscriptionsCron } from './charge-due-subscriptions.cron';

const buildConfig = (enabled: boolean) => ({
  get: jest.fn().mockReturnValue(enabled),
});

const makeMonthlyPlan = () => ({ priceMonthly: 199, priceAnnual: 1990 });
const makeAnnualPlan = () => ({ priceMonthly: 199, priceAnnual: 1990 });

const buildPrisma = (subs: unknown[] = []) => ({
  subscription: {
    findMany: jest.fn().mockResolvedValue(subs),
  },
  subscriptionInvoice: {
    create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
  },
});

const PAST_DATE = new Date(Date.now() - 1000); // already past
const FUTURE_DATE = new Date(Date.now() + 86_400_000); // 1 day from now

describe('ChargeDueSubscriptionsCron', () => {
  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma();
    const cron = new ChargeDueSubscriptionsCron(prisma as never, buildConfig(false) as never);
    await cron.execute();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
    expect(prisma.subscriptionInvoice.create).not.toHaveBeenCalled();
  });

  it('skips subscriptions not yet due (currentPeriodEnd > now)', async () => {
    // findMany is called but returns empty — the WHERE clause filters by currentPeriodEnd lte now
    const prisma = buildPrisma([]);
    const cron = new ChargeDueSubscriptionsCron(prisma as never, buildConfig(true) as never);
    await cron.execute();
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currentPeriodEnd: expect.objectContaining({ lte: expect.any(Date) }),
          status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
        }),
      }),
    );
    expect(prisma.subscriptionInvoice.create).not.toHaveBeenCalled();
  });

  it('creates SubscriptionInvoice with DUE status for each due subscription', async () => {
    const sub = {
      id: 'sub-1',
      organizationId: 'org-1',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-03-01'),
      currentPeriodEnd: PAST_DATE,
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const cron = new ChargeDueSubscriptionsCron(prisma as never, buildConfig(true) as never);
    await cron.execute();

    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledTimes(1);
    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledWith(
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
  });

  it('uses priceAnnual for ANNUAL billing cycle', async () => {
    const sub = {
      id: 'sub-2',
      organizationId: 'org-2',
      billingCycle: 'ANNUAL',
      currentPeriodStart: new Date('2025-04-01'),
      currentPeriodEnd: PAST_DATE,
      plan: makeAnnualPlan(),
    };
    const prisma = buildPrisma([sub]);
    const cron = new ChargeDueSubscriptionsCron(prisma as never, buildConfig(true) as never);
    await cron.execute();

    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledWith(
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
      plan: makeMonthlyPlan(),
    };
    const prisma = buildPrisma([sub]);
    const cron = new ChargeDueSubscriptionsCron(prisma as never, buildConfig(true) as never);
    await cron.execute();

    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flatAmount: 199,
          billingCycle: 'MONTHLY',
        }),
      }),
    );
  });
});
