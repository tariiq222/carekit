import { CronTasksService, CRON_JOBS } from './cron-tasks.service';

const buildCronMock = () => ({ execute: jest.fn().mockResolvedValue(undefined) });

const buildBullMq = () => {
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  let workerProcessor: ((job: { name: string }) => Promise<void>) | null = null;
  return {
    getQueue: jest.fn().mockReturnValue(queue),
    createWorker: jest.fn((_, processor) => { workerProcessor = processor as typeof workerProcessor; }),
    queue,
    getProcessor: () => workerProcessor!,
  };
};

describe('CronTasksService', () => {
  it('schedules all 6 cron jobs on module init', () => {
    const bullMq = buildBullMq();
    const service = new CronTasksService(
      bullMq as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
    );
    service.onModuleInit();

    expect(bullMq.queue.add).toHaveBeenCalledTimes(6);
    Object.values(CRON_JOBS).forEach((name) => {
      expect(bullMq.queue.add).toHaveBeenCalledWith(name, {}, expect.objectContaining({ repeat: expect.anything() }));
    });
  });

  it('registers a worker on the ops-cron queue', () => {
    const bullMq = buildBullMq();
    const service = new CronTasksService(
      bullMq as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
      buildCronMock() as never,
    );
    service.onModuleInit();
    expect(bullMq.createWorker).toHaveBeenCalledWith('ops-cron', expect.any(Function));
  });

  it.each(Object.entries(CRON_JOBS))('worker routes %s job to correct cron handler', async (_, jobName) => {
    const bullMq = buildBullMq();
    const mocks = [buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock(), buildCronMock()];
    const jobOrder = [
      CRON_JOBS.BOOKING_AUTOCOMPLETE,
      CRON_JOBS.BOOKING_EXPIRY,
      CRON_JOBS.BOOKING_NOSHOW,
      CRON_JOBS.APPOINTMENT_REMINDERS,
      CRON_JOBS.GROUP_SESSION_AUTOMATION,
      CRON_JOBS.REFRESH_TOKEN_CLEANUP,
    ];

    const service = new CronTasksService(bullMq as never, ...mocks.map(m => m as never) as [never, never, never, never, never, never]);
    service.onModuleInit();

    const processor = bullMq.getProcessor();
    await processor({ name: jobName });

    const idx = jobOrder.indexOf(jobName as typeof CRON_JOBS[keyof typeof CRON_JOBS]);
    expect(mocks[idx].execute).toHaveBeenCalledTimes(1);
  });
});
