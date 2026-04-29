import { ExpireTrialsCron } from './expire-trials.cron';

const NOW = new Date('2026-05-01T12:00:00.000Z');

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
});

const buildPrisma = (expiredOrgs: Array<{ id: string; nameAr: string }> = [], trialEndingSubs: Array<Record<string, unknown>> = []) => {
  const allTenantsMock = {
    subscription: {
      findMany: jest.fn().mockResolvedValue(trialEndingSubs),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: expiredOrgs.length }),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        user: { email: 'owner@example.com', name: 'Owner' },
      }),
    },
  };

  return {
    organization: {
      findMany: jest.fn().mockResolvedValue(expiredOrgs),
      updateMany: jest.fn().mockResolvedValue({ count: expiredOrgs.length }),
    },
    subscription: {
      updateMany: jest.fn().mockResolvedValue({ count: expiredOrgs.length }),
    },
    $allTenants: allTenantsMock,
  };
};

const buildCache = () => ({ invalidate: jest.fn() });

describe('ExpireTrialsCron', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when BILLING_CRON_ENABLED=false', async () => {
    const prisma = buildPrisma([{ id: 'org-1', nameAr: 'Org' }]);
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(false) as never, buildCache() as never, mailer as never);
    await cron.execute();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no expired trials', async () => {
    const prisma = buildPrisma([]);
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never, mailer as never);
    await cron.execute();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('transitions expired TRIALING orgs to PAST_DUE', async () => {
    const orgs = [{ id: 'org-1', nameAr: 'Org 1' }, { id: 'org-2', nameAr: 'Org 2' }];
    const prisma = buildPrisma(orgs);
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never, mailer as never);
    await cron.execute();
    expect(prisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['org-1', 'org-2'] } },
      data: { status: 'PAST_DUE' },
    });
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { organizationId: { in: ['org-1', 'org-2'] }, status: 'TRIALING' },
      data: { status: 'PAST_DUE', pastDueSince: expect.any(Date) },
    });
  });

  it('invalidates cache for each expired org', async () => {
    const orgs = [{ id: 'org-1', nameAr: 'Org 1' }, { id: 'org-2', nameAr: 'Org 2' }];
    const prisma = buildPrisma(orgs);
    const cache = buildCache();
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, cache as never, mailer as never);
    await cron.execute();
    expect(cache.invalidate).toHaveBeenCalledTimes(2);
  });

  it('sends trial-expired email for each expired org owner', async () => {
    const orgs = [{ id: 'org-1', nameAr: 'Org 1' }];
    const prisma = buildPrisma(orgs);
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never, mailer as never);
    await cron.execute();
    expect(mailer.sendTrialExpired).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ orgName: 'Org 1' }),
    );
  });

  it('sends trial-ending email for subs in window not yet notified', async () => {
    // trialEndsAt 2 days from NOW, within the 3-day window
    const trialEndsAt = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
    const sub = {
      id: 'sub-1',
      organizationId: 'org-1',
      status: 'TRIALING',
      notifiedTrialEndingAt: null,
      organization: { trialEndsAt, nameAr: 'Org 1' },
    };
    const prisma = buildPrisma([], [sub]);
    const mailer = buildMailer();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never, mailer as never);
    await cron.execute();
    expect(mailer.sendTrialEnding).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ daysLeft: 2, orgName: 'Org 1' }),
    );
  });
});
