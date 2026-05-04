import { OrgsWithoutOwnerCron } from './orgs-without-owner.cron';

const buildCls = () => ({
  run: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
  set: jest.fn(),
});

const buildConfig = (env: Record<string, string | undefined>) => ({
  get: jest.fn((k: string) => env[k]),
});

describe('OrgsWithoutOwnerCron', () => {
  it('skips when no orphans', async () => {
    const prisma = {
      $allTenants: { organization: { findMany: jest.fn().mockResolvedValue([]) } },
    };
    const mailer = { sendOrphanOrgsDigest: jest.fn() };
    const cron = new OrgsWithoutOwnerCron(
      prisma as never,
      mailer as never,
      buildCls() as never,
      buildConfig({ PLATFORM_OPS_EMAIL: 'ops@deqah.test' }) as never,
    );
    await cron.execute();
    expect(mailer.sendOrphanOrgsDigest).not.toHaveBeenCalled();
  });

  it('sends a digest when orphans exist', async () => {
    const orphans = [{ id: 'o1', nameAr: 'منظمة', nameEn: 'Org' }];
    const prisma = {
      $allTenants: { organization: { findMany: jest.fn().mockResolvedValue(orphans) } },
    };
    const mailer = { sendOrphanOrgsDigest: jest.fn().mockResolvedValue(undefined) };
    const cron = new OrgsWithoutOwnerCron(
      prisma as never,
      mailer as never,
      buildCls() as never,
      buildConfig({
        PLATFORM_OPS_EMAIL: 'ops@deqah.test',
        PLATFORM_ADMIN_URL: 'https://admin.test',
      }) as never,
    );
    await cron.execute();
    expect(mailer.sendOrphanOrgsDigest).toHaveBeenCalledWith(
      'ops@deqah.test',
      expect.objectContaining({
        orphans,
        adminPanelUrl: 'https://admin.test',
        recipientName: 'Ops',
      }),
    );
  });

  it('skips send when no recipient configured', async () => {
    const orphans = [{ id: 'o1', nameAr: null, nameEn: null }];
    const prisma = {
      $allTenants: { organization: { findMany: jest.fn().mockResolvedValue(orphans) } },
    };
    const mailer = { sendOrphanOrgsDigest: jest.fn() };
    const cron = new OrgsWithoutOwnerCron(
      prisma as never,
      mailer as never,
      buildCls() as never,
      buildConfig({}) as never,
    );
    await cron.execute();
    expect(mailer.sendOrphanOrgsDigest).not.toHaveBeenCalled();
  });

  it('falls back to RESEND_REPLY_TO when PLATFORM_OPS_EMAIL is unset', async () => {
    const orphans = [{ id: 'o1', nameAr: null, nameEn: null }];
    const prisma = {
      $allTenants: { organization: { findMany: jest.fn().mockResolvedValue(orphans) } },
    };
    const mailer = { sendOrphanOrgsDigest: jest.fn().mockResolvedValue(undefined) };
    const cron = new OrgsWithoutOwnerCron(
      prisma as never,
      mailer as never,
      buildCls() as never,
      buildConfig({ RESEND_REPLY_TO: 'reply@deqah.test' }) as never,
    );
    await cron.execute();
    expect(mailer.sendOrphanOrgsDigest).toHaveBeenCalledWith(
      'reply@deqah.test',
      expect.any(Object),
    );
  });
});
