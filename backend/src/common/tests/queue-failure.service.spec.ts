/**
 * QueueFailureService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { QueueFailureService } from '../queue/queue-failure.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';
import { MetricsService } from '../metrics/metrics.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findMany: jest.fn(),
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNotifications: any = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMetrics: any = {
  jobFailuresTotal: {
    inc: jest.fn(),
  },
};

describe('QueueFailureService', () => {
  let service: QueueFailureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueFailureService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<QueueFailureService>(QueueFailureService);
    jest.clearAllMocks();
    mockNotifications.createNotification.mockResolvedValue(undefined);
  });

  describe('notifyAdminsOfFailure', () => {
    const error = new Error('Job timed out');
    const queueName = 'bookings';
    const jobName = 'expire-pending';
    const jobId = 'job-123';
    const jobData = { bookingId: 'b-1' };

    it('should increment metrics counter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.notifyAdminsOfFailure(queueName, jobName, jobId, jobData, error);

      expect(mockMetrics.jobFailuresTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({ queue: queueName, job_name: jobName }),
      );
    });

    it('should skip notifications when no admins found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.notifyAdminsOfFailure(queueName, jobName, jobId, jobData, error);

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('should notify all found admins', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      await service.notifyAdminsOfFailure(queueName, jobName, jobId, jobData, error);

      expect(mockNotifications.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', type: 'system_alert' }),
      );
    });

    it('should not throw when prisma fails', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        service.notifyAdminsOfFailure(queueName, jobName, undefined, jobData, error),
      ).resolves.not.toThrow();
    });

    it('should not throw when a notification fails', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockNotifications.createNotification.mockRejectedValue(new Error('FCM error'));

      await expect(
        service.notifyAdminsOfFailure(queueName, jobName, jobId, jobData, error),
      ).resolves.not.toThrow();
    });
  });
});
