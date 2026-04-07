/** CareKit — TasksBootstrapService Unit Tests */

import { Test, TestingModule } from '@nestjs/testing';
import { TasksBootstrapService } from '../../../src/modules/tasks/tasks-bootstrap.service.js';

// ── Constants ──

const QUEUE_TASKS = 'tasks';

// ── Mock Queue ──

function createMockQueue() {
  return {
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

// ── Test Suite ──

describe('TasksBootstrapService', () => {
  let service: TasksBootstrapService;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksBootstrapService,
        { provide: `BullQueue_${QUEUE_TASKS}`, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<TasksBootstrapService>(TasksBootstrapService);
  });

  // ────────────────────────────────────────────
  // onModuleInit — Job Registration
  // ────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should register 14 repeatable jobs on init', async () => {
      await service.onModuleInit();

      // 14 jobs should be added
      expect(mockQueue.add).toHaveBeenCalledTimes(14);
    });

    it('should remove stale jobs (not in desired set) and keep known jobs', async () => {
      const oldJobs = [
        { key: 'stale-job:::* * * * *', id: '1', name: 'stale-job' },
      ];
      mockQueue.getRepeatableJobs.mockResolvedValue(oldJobs);

      await service.onModuleInit();

      expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('stale-job:::* * * * *');
    });

    it('should register cleanup-otps with daily 3AM schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'cleanup-otps',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 3 * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register cleanup-tokens with daily 3:30 AM schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'cleanup-tokens',
        {},
        expect.objectContaining({
          repeat: { pattern: '30 3 * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register reminder-24h with every hour schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'reminder-24h',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register reminder-1h with every 15 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'reminder-1h',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register expire-pending-bookings with every 5 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'expire-pending-bookings',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/5 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register auto-complete-bookings with every 15 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'auto-complete-bookings',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register auto-no-show with every 10 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'auto-no-show',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/10 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register expire-pending-cancellations with every hour schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'expire-pending-cancellations',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register reminder-2h with every 15 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'reminder-2h',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/15 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register reminder-15min with every 5 min schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'reminder-15min',
        {},
        expect.objectContaining({
          repeat: { pattern: '*/5 * * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register cleanup-webhooks with daily 4AM schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'cleanup-webhooks',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 4 * * *' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register archive-activity-logs with weekly schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'archive-activity-logs',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 5 * * 0' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register repair-rating-cache with weekly schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'repair-rating-cache',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 6 * * 0' },
          removeOnComplete: true,
        }),
      );
    });

    it('should register db-snapshot with weekly midnight schedule', async () => {
      await service.onModuleInit();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'db-snapshot',
        {},
        expect.objectContaining({
          repeat: { pattern: '0 0 * * 0' },
          removeOnComplete: true,
        }),
      );
    });

    it('should NOT remove jobs that are already registered with the desired name', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { key: 'expire-pending-bookings:::*/5 * * * *', name: 'expire-pending-bookings', pattern: '*/5 * * * *' },
      ]);

      await service.onModuleInit();

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });

    it('should remove stale jobs that are no longer in the desired set', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([
        { key: 'old-job:::* * * * *', name: 'old-job', pattern: '* * * * *' },
      ]);

      await service.onModuleInit();

      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('old-job:::* * * * *');
    });

    it('should not add jobs that already exist', async () => {
      const allJobNames = [
        'cleanup-otps', 'cleanup-tokens', 'reminder-24h', 'reminder-1h',
        'expire-pending-bookings', 'auto-complete-bookings', 'auto-no-show',
        'expire-pending-cancellations', 'reminder-2h', 'reminder-15min',
        'cleanup-webhooks', 'archive-activity-logs', 'repair-rating-cache', 'db-snapshot',
      ];
      mockQueue.getRepeatableJobs.mockResolvedValue(
        allJobNames.map(name => ({ key: `${name}:::* * * * *`, name, pattern: '* * * * *' })),
      );

      await service.onModuleInit();

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should handle errors during job registration gracefully', async () => {
      mockQueue.add.mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(service.onModuleInit()).rejects.toThrow('Redis connection failed');
    });

    it('should handle errors during removal of old jobs', async () => {
      mockQueue.getRepeatableJobs.mockRejectedValue(new Error('Redis down'));

      await expect(service.onModuleInit()).rejects.toThrow('Redis down');
    });

    it('should set removeOnComplete for all jobs', async () => {
      await service.onModuleInit();

      const calls = mockQueue.add.mock.calls;
      for (const call of calls) {
        const options = call[2] as { removeOnComplete: boolean };
        expect(options.removeOnComplete).toBe(true);
      }
    });

    it('should register all expected job names', async () => {
      await service.onModuleInit();

      const registeredNames = mockQueue.add.mock.calls.map(
        (call: any[]) => call[0],
      );
      const expectedNames = [
        'cleanup-otps',
        'cleanup-tokens',
        'reminder-24h',
        'reminder-1h',
        'expire-pending-bookings',
        'auto-complete-bookings',
        'auto-no-show',
        'expire-pending-cancellations',
        'reminder-2h',
        'reminder-15min',
        'cleanup-webhooks',
        'archive-activity-logs',
        'repair-rating-cache',
        'db-snapshot',
      ];

      expect(registeredNames).toEqual(expectedNames);
    });
  });
});
