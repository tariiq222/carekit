import { CustomDomainGraceCron } from './custom-domain-grace.cron';

const buildConfig = (cronEnabled = true) => ({
  get: jest.fn().mockImplementation((key: string, def: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return cronEnabled;
    return def;
  }),
});

const buildMailer = () => ({
  sendFeatureGraceWarning: jest.fn().mockResolvedValue(undefined),
  sendFeatureGraceExpired: jest.fn().mockResolvedValue(undefined),
});

const makeOrg = (daysFromNow: number) => ({
  organizationId: 'org-1',
  customDomain: 'custom.example.com',
  customDomainGraceUntil: new Date(Date.now() + daysFromNow * 86_400_000),
});

const makeOwner = () => ({
  displayName: 'Tariq',
  user: { email: 'owner@sawa.sa', name: 'Tariq' },
  organization: { nameAr: 'عيادة سواء' },
});

const buildPrisma = (org: ReturnType<typeof makeOrg>, owner: ReturnType<typeof makeOwner> | null = makeOwner()) => ({
  $allTenants: {
    organizationSettings: {
      findMany: jest.fn().mockResolvedValue([org]),
      update: jest.fn().mockResolvedValue({}),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue(owner),
    },
  },
});

describe('CustomDomainGraceCron', () => {
  it('sends warning email when daysLeft <= 7 (> 0)', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(makeOrg(5));
    const cron = new CustomDomainGraceCron(prisma as never, mailer as never, buildConfig() as never);
    await cron.run();
    expect(mailer.sendFeatureGraceWarning).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'custom_domain', daysLeft: 5 }),
    );
    expect(mailer.sendFeatureGraceExpired).not.toHaveBeenCalled();
    expect(prisma.$allTenants.organizationSettings.update).not.toHaveBeenCalled();
  });

  it('does NOT send warning when daysLeft > 7', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(makeOrg(15));
    const cron = new CustomDomainGraceCron(prisma as never, mailer as never, buildConfig() as never);
    await cron.run();
    expect(mailer.sendFeatureGraceWarning).not.toHaveBeenCalled();
    expect(mailer.sendFeatureGraceExpired).not.toHaveBeenCalled();
  });

  it('reverts domain and sends expired email when daysLeft <= 0', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(makeOrg(-1));
    const cron = new CustomDomainGraceCron(prisma as never, mailer as never, buildConfig() as never);
    await cron.run();
    expect(prisma.$allTenants.organizationSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        data: { customDomain: null, customDomainGraceUntil: null },
      }),
    );
    expect(mailer.sendFeatureGraceExpired).toHaveBeenCalledWith(
      'owner@sawa.sa',
      expect.objectContaining({ featureKey: 'custom_domain' }),
    );
    expect(mailer.sendFeatureGraceWarning).not.toHaveBeenCalled();
  });

  it('skips when BILLING_CRON_ENABLED is false', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(makeOrg(3));
    const cron = new CustomDomainGraceCron(prisma as never, mailer as never, buildConfig(false) as never);
    await cron.run();
    expect(prisma.$allTenants.organizationSettings.findMany).not.toHaveBeenCalled();
  });

  it('skips email when owner not found', async () => {
    const mailer = buildMailer();
    const prisma = buildPrisma(makeOrg(5), null);
    const cron = new CustomDomainGraceCron(prisma as never, mailer as never, buildConfig() as never);
    await cron.run();
    expect(mailer.sendFeatureGraceWarning).not.toHaveBeenCalled();
  });
});
