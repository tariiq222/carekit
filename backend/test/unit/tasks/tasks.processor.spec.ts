import { TasksProcessor } from '../../../src/modules/tasks/tasks.processor.js';
import { QUEUE_TASKS } from '../../../src/config/constants/queues.js';

const mockCleanup = {
  cleanExpiredOtps: jest.fn(),
  cleanExpiredRefreshTokens: jest.fn(),
  cleanOldProcessedWebhooks: jest.fn(),
  archiveOldActivityLogs: jest.fn(),
  repairPractitionerRatingCache: jest.fn(),
  logTableGrowthSnapshot: jest.fn(),
};

const mockReminder = {
  sendDayBeforeReminders: jest.fn(),
  sendHourBeforeReminders: jest.fn(),
  sendTwoHourReminders: jest.fn(),
  sendUrgentReminders: jest.fn(),
};

const mockAutomation = {
  expirePendingBookings: jest.fn(),
  autoCompleteBookings: jest.fn(),
  autoNoShow: jest.fn(),
  autoExpirePendingCancellations: jest.fn(),
};

const mockQueueFailure = {
  notifyAdminsOfFailure: jest.fn(),
};

describe('TasksProcessor', () => {
  let processor: TasksProcessor;
  let workerOnHandlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    workerOnHandlers = {};

    processor = new TasksProcessor(
      mockCleanup as any,
      mockReminder as any,
      mockAutomation as any,
      mockQueueFailure as any,
    );

    // WorkerHost exposes 'worker' as a getter-only property — use defineProperty to mock it.
    // The same mockWorker instance must be returned on every access so spy assertions work.
    const mockWorker = {
      on: jest.fn((event: string, handler: Function) => {
        workerOnHandlers[event] = handler;
      }),
    };
    Object.defineProperty(processor, 'worker', {
      configurable: true,
      get: () => mockWorker,
    });
  });

  describe('process() — job routing', () => {
    const jobCases: Array<[string, () => jest.Mock]> = [
      ['cleanup-otps', () => mockCleanup.cleanExpiredOtps],
      ['cleanup-tokens', () => mockCleanup.cleanExpiredRefreshTokens],
      ['cleanup-webhooks', () => mockCleanup.cleanOldProcessedWebhooks],
      ['archive-activity-logs', () => mockCleanup.archiveOldActivityLogs],
      ['repair-rating-cache', () => mockCleanup.repairPractitionerRatingCache],
      ['db-snapshot', () => mockCleanup.logTableGrowthSnapshot],
      ['reminder-24h', () => mockReminder.sendDayBeforeReminders],
      ['reminder-1h', () => mockReminder.sendHourBeforeReminders],
      ['reminder-2h', () => mockReminder.sendTwoHourReminders],
      ['reminder-15min', () => mockReminder.sendUrgentReminders],
      ['expire-pending-bookings', () => mockAutomation.expirePendingBookings],
      ['auto-complete-bookings', () => mockAutomation.autoCompleteBookings],
      ['auto-no-show', () => mockAutomation.autoNoShow],
      ['expire-pending-cancellations', () => mockAutomation.autoExpirePendingCancellations],
    ];

    it.each(jobCases)('should route job "%s" to the correct service method', async (jobName, getMock) => {
      const job = { name: jobName } as any;
      getMock().mockResolvedValue(undefined);

      await processor.process(job);

      expect(getMock()).toHaveBeenCalledTimes(1);
    });

    it('should log warning for unknown job names', async () => {
      const loggerSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation();
      const job = { name: 'unknown-job' } as any;

      await processor.process(job);

      expect(loggerSpy).toHaveBeenCalledWith('Unknown task job: unknown-job');
      loggerSpy.mockRestore();
    });
  });

  describe('onModuleInit()', () => {
    it('should register a failed handler on worker', () => {
      processor.onModuleInit();
      expect((processor as any).worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should notify admins when job failure is final (attempts exhausted)', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'cleanup-otps', id: 'job-1', data: {}, attemptsMade: 3, opts: { attempts: 3 } };
      const error = new Error('DB connection lost');

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalledWith(
        QUEUE_TASKS,
        'cleanup-otps',
        'job-1',
        {},
        error,
      );
    });

    it('should notify admins for UnrecoverableError regardless of attempts', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'reminder-1h', id: 'job-2', data: {}, attemptsMade: 1, opts: { attempts: 3 } };
      const error = Object.assign(new Error('Unrecoverable'), { name: 'UnrecoverableError' });

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalled();
    });

    it('should NOT notify admins for non-final failures', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const job = { name: 'cleanup-otps', id: 'job-3', data: {}, attemptsMade: 1, opts: { attempts: 3 } };
      const error = new Error('Temporary');

      await handler(job, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).not.toHaveBeenCalled();
    });

    it('should handle null job gracefully', async () => {
      processor.onModuleInit();
      const handler = workerOnHandlers['failed'];

      const error = Object.assign(new Error('Fatal'), { name: 'UnrecoverableError' });

      await handler(null, error);

      expect(mockQueueFailure.notifyAdminsOfFailure).toHaveBeenCalledWith(
        QUEUE_TASKS,
        'unknown',
        undefined,
        undefined,
        error,
      );
    });
  });
});
