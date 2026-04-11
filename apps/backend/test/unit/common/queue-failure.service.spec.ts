/**
 * QueueFailureService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { QueueFailureService } from '../../../src/common/queue/queue-failure.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsInboxService } from '../../../src/modules/messaging/inbox/notifications-inbox.service.js';
import { MetricsService } from '../../../src/common/metrics/metrics.service.js';

const mockPrisma: any = {
  user: {
    findMany: jest.fn(),
  },
};

const mockNotifications: any = {
  createSystemAlert: jest.fn().mockResolvedValue(undefined),
};

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
        { provide: NotificationsInboxService, useValue: mockNotifications },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<QueueFailureService>(QueueFailureService);
    jest.clearAllMocks();
    mockNotifications.createSystemAlert.mockResolvedValue(undefined);
  });

  describe('notifyAdminsOfFailure', () => {
    const error = new Error('Job timed out');
    const queueName = 'bookings';
    const jobName = 'expire-pending';
    const jobId = 'job-123';
    const jobData = { bookingId: 'b-1' };

    it('should increment metrics counter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.notifyAdminsOfFailure(
        queueName,
        jobName,
        jobId,
        jobData,
        error,
      );

      expect(mockMetrics.jobFailuresTotal.inc).toHaveBeenCalledWith(
        expect.objectContaining({ queue: queueName, job_name: jobName }),
      );
    });

    it('should skip notifications when no admins found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.notifyAdminsOfFailure(
        queueName,
        jobName,
        jobId,
        jobData,
        error,
      );

      expect(mockNotifications.createSystemAlert).not.toHaveBeenCalled();
    });

    it('should notify all found admins', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      await service.notifyAdminsOfFailure(
        queueName,
        jobName,
        jobId,
        jobData,
        error,
      );

      expect(mockNotifications.createSystemAlert).toHaveBeenCalledTimes(2);
      expect(mockNotifications.createSystemAlert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1' }),
      );
    });

    it('should not throw when prisma fails', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        service.notifyAdminsOfFailure(
          queueName,
          jobName,
          undefined,
          jobData,
          error,
        ),
      ).resolves.not.toThrow();
    });

    it('should not throw when a notification fails', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockNotifications.createSystemAlert.mockRejectedValue(
        new Error('FCM error'),
      );

      await expect(
        service.notifyAdminsOfFailure(
          queueName,
          jobName,
          jobId,
          jobData,
          error,
        ),
      ).resolves.not.toThrow();
    });
  });
});
