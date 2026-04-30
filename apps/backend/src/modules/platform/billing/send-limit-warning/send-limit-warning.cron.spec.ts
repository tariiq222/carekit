import { SendLimitWarningCron } from './send-limit-warning.cron';

const PERIOD_START = new Date('2026-04-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-05-01T00:00:00.000Z');

const buildConfig = (enabled: boolean) => ({
  get: jest.fn((key: string, defaultValue?: unknown) => {
    if (key === 'BILLING_CRON_ENABLED') return enabled;
    return defaultValue;
  }),
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  organizationId: 'org-1',
  status: 'ACTIVE',
  currentPeriodStart: PERIOD_START,
  currentPeriodEnd: PERIOD_END,
  plan: {
    limits: { maxEmployees: 10 },
  },
  ...overrides,
});

const buildPrisma = (subscriptions: unknown[] = []) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subscriptions),
    },
    employee: {
      count: jest.fn().mockResolvedValue(8),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue({
        userId: 'owner-user-1',
        user: { name: 'Owner User' },
      }),
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    },
  },
});

const buildCron = (
  prisma: ReturnType<typeof buildPrisma>,
  config = buildConfig(true),
) => new SendLimitWarningCron(prisma as never, config as never);

describe('SendLimitWarningCron', () => {
  it('does nothing when billing cron is disabled', async () => {
    const prisma = buildPrisma([subscription()]);
    const cron = buildCron(prisma, buildConfig(false));

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).not.toHaveBeenCalled();
    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });

  it('finds active and trialing subscriptions with plans included', async () => {
    const prisma = buildPrisma([]);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.subscription.findMany).toHaveBeenCalledWith({
      where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      include: { plan: true },
    });
  });

  it('counts active employees for each limited subscription', async () => {
    const prisma = buildPrisma([subscription()]);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.employee.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', isActive: true },
    });
  });

  it('creates one owner notification when employee usage reaches 80 percent', async () => {
    const prisma = buildPrisma([subscription()]);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', role: 'OWNER', isActive: true },
      include: { user: { select: { name: true } } },
    });
    expect(prisma.$allTenants.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        recipientId: 'owner-user-1',
        recipientType: 'EMPLOYEE',
        type: 'GENERAL',
        metadata: { kind: 'EMPLOYEES', threshold: 80 },
      }),
    });
  });

  it('skips when a matching notification already exists in the current period', async () => {
    const prisma = buildPrisma([subscription()]);
    prisma.$allTenants.notification.findFirst.mockResolvedValue({ id: 'existing' });
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.notification.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        recipientId: 'owner-user-1',
        type: 'GENERAL',
        createdAt: { gte: PERIOD_START, lt: PERIOD_END },
        AND: [
          { metadata: { path: ['kind'], equals: 'EMPLOYEES' } },
          { metadata: { path: ['threshold'], equals: 80 } },
        ],
      },
    });
    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });

  it('does not notify for unlimited, zero, or non-numeric employee limits', async () => {
    const prisma = buildPrisma([
      subscription({ id: 'sub-unlimited', plan: { limits: { maxEmployees: -1 } } }),
      subscription({ id: 'sub-zero', plan: { limits: { maxEmployees: 0 } } }),
      subscription({ id: 'sub-missing', plan: { limits: {} } }),
    ]);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.employee.count).not.toHaveBeenCalled();
    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });
});
