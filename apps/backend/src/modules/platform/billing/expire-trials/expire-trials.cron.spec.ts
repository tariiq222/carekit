import { ExpireTrialsCron } from './expire-trials.cron';

const NOW = new Date('2026-05-01T12:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return def;
  }),
});

const buildPrisma = (orgs: Array<{ id: string }> = []) => ({
  organization: {
    findMany: jest.fn().mockResolvedValue(orgs),
    updateMany: jest.fn().mockResolvedValue({ count: orgs.length }),
  },
  subscription: {
    updateMany: jest.fn().mockResolvedValue({ count: orgs.length }),
  },
});

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
    const prisma = buildPrisma([{ id: 'org-1' }]);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(false) as never, buildCache() as never);
    await cron.execute();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it('does nothing when no expired trials', async () => {
    const prisma = buildPrisma([]);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never);
    await cron.execute();
    expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it('transitions expired TRIALING orgs to PAST_DUE', async () => {
    const orgs = [{ id: 'org-1' }, { id: 'org-2' }];
    const prisma = buildPrisma(orgs);
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, buildCache() as never);
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
    const orgs = [{ id: 'org-1' }, { id: 'org-2' }];
    const prisma = buildPrisma(orgs);
    const cache = buildCache();
    const cron = new ExpireTrialsCron(prisma as never, buildConfig(true) as never, cache as never);
    await cron.execute();
    expect(cache.invalidate).toHaveBeenCalledTimes(2);
  });
});
