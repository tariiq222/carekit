import { ApiWebhooksGraceCron } from './api-webhooks-grace.cron';

const buildConfig = (cronEnabled = true) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return cronEnabled;
    return def;
  }),
});

const buildMailer = () => ({
  sendFeatureGraceWarning: jest.fn().mockResolvedValue(undefined),
});

const makeOwner = () => ({
  displayName: 'Tariq',
  user: { email: 'owner@sawa.sa', name: 'Tariq' },
  organization: { nameAr: 'عيادة سواء' },
});

const buildPrisma = (
  subs: Array<{ organizationId: string; apiAccessGraceUntil: Date | null; webhooksGraceUntil: Date | null }>,
  owner: ReturnType<typeof makeOwner> | null = makeOwner(),
) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subs),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue(owner),
    },
  },
});

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

describe('ApiWebhooksGraceCron', () => {
  it('sends api_access warning on day 6', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(6), webhooksGraceUntil: null },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'api_access', daysLeft: 6 }),
    );
  });

  it('sends api_access warning on day 3', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(3), webhooksGraceUntil: null },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'api_access', daysLeft: 3 }),
    );
  });

  it('sends api_access warning on day 1', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(1), webhooksGraceUntil: null },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'api_access', daysLeft: 1 }),
    );
  });

  it('does NOT send warning when not on a warning day (e.g. day 5)', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(5), webhooksGraceUntil: null },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).not.toHaveBeenCalled();
  });

  it('sends webhooks warning independently', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: null, webhooksGraceUntil: daysFromNow(3) },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'webhooks', daysLeft: 3 }),
    );
  });

  it('sends two warnings when both api_access and webhooks are on warning day', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(6), webhooksGraceUntil: daysFromNow(6) },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledTimes(2);
  });

  it('skips when BILLING_CRON_ENABLED is false', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma([
      { organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(3), webhooksGraceUntil: null },
    ]);
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig(false) as never).run();
    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
  });

  it('skips email when owner not found', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(
      [{ organizationId: 'org-1', apiAccessGraceUntil: daysFromNow(3), webhooksGraceUntil: null }],
      null,
    );
    await new ApiWebhooksGraceCron(prisma as never, mailer as never, buildConfig() as never).run();
    expect(mailer.sendFeatureGraceWarning).not.toHaveBeenCalled();
  });
});
