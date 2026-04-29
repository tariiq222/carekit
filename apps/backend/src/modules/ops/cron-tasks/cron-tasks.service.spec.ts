import { CronTasksService, CRON_JOBS } from './cron-tasks.service';

const buildCronMock = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const buildBullMq = () => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const worker = { on: jest.fn() };
  let workerProcessor: ((job: { name: string }) => Promise<void>) | null = null;
  return {
    getQueue: jest.fn().mockReturnValue(queue),
    createWorker: jest.fn((_, processor) => {
      workerProcessor = processor as typeof workerProcessor;
      return worker;
    }),
    queue,
    worker,
    getProcessor: () => workerProcessor!,
  };
};

type CronDeps = [never, never, never, never, never, never, never, never, never, never, never];

/** Build 11 cron mocks (all injected crons except BullMqService itself). */
const buildAllMocks = () => [
  buildCronMock(), // bookingAutocomplete
  buildCronMock(), // bookingExpiry
  buildCronMock(), // bookingNoShow
  buildCronMock(), // appointmentReminders
  buildCronMock(), // groupSessionAutomation
  buildCronMock(), // refreshTokenCleanup
  buildCronMock(), // meterUsage
  buildCronMock(), // chargeDueSubscriptions
  buildCronMock(), // computeOverage
  buildCronMock(), // enforceGracePeriod
  buildCronMock(), // expireImpersonationSessions (SaaS-05b)
] as const;

const buildService = (bullMq: ReturnType<typeof buildBullMq>, mocks: ReturnType<typeof buildAllMocks>) =>
  new CronTasksService(bullMq as never, ...(mocks.map((m) => m as never) as CronDeps));

describe('CronTasksService', () => {
  it('schedules all 10 cron jobs on module init', () => {
    const bullMq = buildBullMq();
    const mocks = buildAllMocks();
    const service = buildService(bullMq, mocks);
    service.onModuleInit();

    expect(bullMq.queue.add).toHaveBeenCalledTimes(10);
    Object.values(CRON_JOBS).forEach((name) => {
      expect(bullMq.queue.add).toHaveBeenCalledWith(name, {}, expect.objectContaining({ repeat: expect.anything() }));
    });
  });

  it('registers a worker on the ops-cron queue', () => {
    const bullMq = buildBullMq();
    const mocks = buildAllMocks();
    const service = buildService(bullMq, mocks);
    service.onModuleInit();
    expect(bullMq.createWorker).toHaveBeenCalledWith('ops-cron', expect.any(Function));
    expect(bullMq.worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  // Worker routing — maps each schedulable job to its handler mock index
  const ROUTED_JOBS: Array<[string, number]> = [
    [CRON_JOBS.BOOKING_AUTOCOMPLETE, 0],
    [CRON_JOBS.BOOKING_EXPIRY, 1],
    [CRON_JOBS.BOOKING_NOSHOW, 2],
    [CRON_JOBS.APPOINTMENT_REMINDERS, 3],
    [CRON_JOBS.GROUP_SESSION_AUTOMATION, 4],
    [CRON_JOBS.REFRESH_TOKEN_CLEANUP, 5],
    [CRON_JOBS.METER_USAGE, 6],
    [CRON_JOBS.CHARGE_DUE_SUBSCRIPTIONS, 7],
    [CRON_JOBS.ENFORCE_GRACE_PERIOD, 9],
    [CRON_JOBS.EXPIRE_IMPERSONATION_SESSIONS, 10],
  ];

  it.each(ROUTED_JOBS)('worker routes %s job to correct cron handler', async (jobName, idx) => {
    const bullMq = buildBullMq();
    const mocks = buildAllMocks();
    const service = buildService(bullMq, mocks);
    service.onModuleInit();

    const processor = bullMq.getProcessor();
    await processor({ name: jobName });

    expect(mocks[idx].execute).toHaveBeenCalledTimes(1);
  });
});
