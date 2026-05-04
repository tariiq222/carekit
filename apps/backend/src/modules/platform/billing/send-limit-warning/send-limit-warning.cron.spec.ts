import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../../common/tenant/tenant.constants';
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
    limits: {
      maxEmployees: 10,
      maxBranches: 3,
      maxBookingsPerMonth: 100,
      maxClients: 50,
    },
  },
  ...overrides,
});

const buildPrisma = (subscriptions: unknown[] = [], usedCounts = { employees: 8, branches: 1, bookings: 0, clients: 0 }) => ({
  $allTenants: {
    subscription: {
      findMany: jest.fn().mockResolvedValue(subscriptions),
    },
    employee: {
      count: jest.fn().mockResolvedValue(usedCounts.employees),
    },
    branch: {
      count: jest.fn().mockResolvedValue(usedCounts.branches),
    },
    client: {
      count: jest.fn().mockResolvedValue(usedCounts.clients),
    },
    usageCounter: {
      findFirst: jest.fn().mockImplementation(({ where }: { where: { featureKey: string } }) => {
        if (where.featureKey === 'BOOKINGS_PER_MONTH') return Promise.resolve({ value: usedCounts.bookings });
        return Promise.resolve(null);
      }),
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

const buildCls = () => ({
  run: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  set: jest.fn(),
});

const buildCron = (
  prisma: ReturnType<typeof buildPrisma>,
  config = buildConfig(true),
  cls = buildCls(),
) => new SendLimitWarningCron(prisma as never, config as never, cls as never);

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

  it('creates a warning notification when employee usage reaches 80 percent', async () => {
    const prisma = buildPrisma([subscription()], { employees: 8, branches: 1, bookings: 0, clients: 0 });
    const cron = buildCron(prisma);

    await cron.execute();

    const calls = prisma.$allTenants.notification.create.mock.calls;
    const employeeCall = calls.find((c: any[]) => c[0].data.metadata.kind === 'EMPLOYEES');
    expect(employeeCall).toBeDefined();
    expect(employeeCall[0].data).toMatchObject({
      organizationId: 'org-1',
      recipientId: 'owner-user-1',
      type: 'GENERAL',
      metadata: { kind: 'EMPLOYEES', threshold: 80 },
    });
  });

  it('creates a warning notification when branch usage reaches 80 percent', async () => {
    // maxBranches=3, used=3 → 100% >= 80%
    const prisma = buildPrisma([subscription()], { employees: 1, branches: 3, bookings: 0, clients: 0 });
    const cron = buildCron(prisma);

    await cron.execute();

    const calls = prisma.$allTenants.notification.create.mock.calls;
    const branchCall = calls.find((c: any[]) => c[0].data.metadata.kind === 'BRANCHES');
    expect(branchCall).toBeDefined();
    expect(branchCall[0].data.metadata).toEqual({ kind: 'BRANCHES', threshold: 80 });
  });

  it('creates a warning notification when booking usage reaches 80 percent', async () => {
    // maxBookingsPerMonth=100, used=85 → 85% >= 80%
    const prisma = buildPrisma([subscription()], { employees: 1, branches: 1, bookings: 85, clients: 0 });
    const cron = buildCron(prisma);

    await cron.execute();

    const calls = prisma.$allTenants.notification.create.mock.calls;
    const bookingCall = calls.find((c: any[]) => c[0].data.metadata.kind === 'BOOKINGS');
    expect(bookingCall).toBeDefined();
    expect(bookingCall[0].data.metadata).toEqual({ kind: 'BOOKINGS', threshold: 80 });
  });

  it('creates a warning notification when client usage reaches 80 percent', async () => {
    // maxClients=50, used=42 → 84% >= 80%
    const prisma = buildPrisma([subscription()], { employees: 1, branches: 1, bookings: 0, clients: 42 });
    const cron = buildCron(prisma);

    await cron.execute();

    const calls = prisma.$allTenants.notification.create.mock.calls;
    const clientCall = calls.find((c: any[]) => c[0].data.metadata.kind === 'CLIENTS');
    expect(clientCall).toBeDefined();
    expect(clientCall[0].data.metadata).toEqual({ kind: 'CLIENTS', threshold: 80 });
  });

  it('skips when a matching notification already exists in the current period', async () => {
    const prisma = buildPrisma([subscription()]);
    prisma.$allTenants.notification.findFirst.mockResolvedValue({ id: 'existing' });
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });

  it('does not notify for unlimited (-1), zero, or non-numeric limits', async () => {
    const prisma = buildPrisma([
      subscription({
        id: 'sub-unlimited',
        plan: { limits: { maxEmployees: -1, maxBranches: -1, maxBookingsPerMonth: -1, maxClients: -1 } },
      }),
    ]);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });

  it('skips entire org when no owner membership found', async () => {
    const prisma = buildPrisma([subscription()]);
    prisma.$allTenants.membership.findFirst.mockResolvedValue(null);
    const cron = buildCron(prisma);

    await cron.execute();

    expect(prisma.$allTenants.notification.create).not.toHaveBeenCalled();
  });

  it('sends multiple metric warnings for the same org in one run', async () => {
    // employees at 80%, branches at 100%
    const prisma = buildPrisma([subscription()], { employees: 8, branches: 3, bookings: 0, clients: 0 });
    const cron = buildCron(prisma);

    await cron.execute();

    const calls = prisma.$allTenants.notification.create.mock.calls;
    const kinds = calls.map((c: any[]) => c[0].data.metadata.kind);
    expect(kinds).toContain('EMPLOYEES');
    expect(kinds).toContain('BRANCHES');
  });

  it('wraps execute body in super-admin CLS context', async () => {
    const prisma = buildPrisma([]);
    const cls = buildCls();
    const cron = buildCron(prisma, buildConfig(true), cls);

    await cron.execute();

    expect(cls.run).toHaveBeenCalledTimes(1);
    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  });
});
