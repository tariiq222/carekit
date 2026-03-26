/**
 * BookingCancellationTimeoutService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingCancellationTimeoutService } from '../booking-cancellation-timeout.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';
import { WaitlistService } from '../../bookings/waitlist.service.js';

const defaultSettings = {
  cancellationReviewTimeoutHours: 24,
};

const mockPrisma: Record<string, jest.Mock | Record<string, jest.Mock>> = {
  booking: {
    findMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockNotifications = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};

const mockActivityLog = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockSettings = {
  get: jest.fn().mockResolvedValue(defaultSettings),
};

const mockWaitlist = {
  checkAndNotify: jest.fn().mockResolvedValue(undefined),
};

describe('BookingCancellationTimeoutService', () => {
  let service: BookingCancellationTimeoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingCancellationTimeoutService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingSettingsService, useValue: mockSettings },
        { provide: WaitlistService, useValue: mockWaitlist },
      ],
    }).compile();

    service = module.get<BookingCancellationTimeoutService>(BookingCancellationTimeoutService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    (mockPrisma.booking as Record<string, jest.Mock>).update.mockResolvedValue({});
    (mockPrisma.payment as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);
    (mockPrisma.payment as Record<string, jest.Mock>).update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
  });

  describe('autoExpirePendingCancellations', () => {
    it('should do nothing when no stale cancellations', async () => {
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([]);

      await service.autoExpirePendingCancellations();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should cancel stale pending_cancellation bookings', async () => {
      const staleBooking = {
        id: 'b-1',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date('2026-04-01'),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([staleBooking]);

      await service.autoExpirePendingCancellations();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-1' },
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
    });

    it('should refund paid payment when booking cancelled by timeout', async () => {
      const staleBooking = {
        id: 'b-2',
        patientId: 'patient-2',
        practitionerId: 'pract-1',
        date: new Date(),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([staleBooking]);
      (mockPrisma.payment as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'paid',
        totalAmount: 10000,
      });

      await service.autoExpirePendingCancellations();

      expect((mockPrisma.payment as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: { status: 'refunded', refundAmount: 10000 },
        }),
      );
    });

    it('should skip refund when payment status is not paid', async () => {
      const staleBooking = {
        id: 'b-3',
        patientId: null,
        practitionerId: 'pract-1',
        date: new Date(),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([staleBooking]);
      (mockPrisma.payment as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'pay-2',
        status: 'awaiting',
        totalAmount: 10000,
      });

      await service.autoExpirePendingCancellations();

      expect((mockPrisma.payment as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should notify patient when patientId is set', async () => {
      const staleBooking = {
        id: 'b-4',
        patientId: 'patient-4',
        practitionerId: 'pract-1',
        date: new Date(),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([staleBooking]);

      await service.autoExpirePendingCancellations();

      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'patient-4', type: 'booking_cancelled' }),
      );
    });

    it('should call waitlist checkAndNotify after cancellation', async () => {
      const staleBooking = {
        id: 'b-5',
        patientId: null,
        practitionerId: 'pract-5',
        date: new Date('2026-05-10'),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([staleBooking]);

      await service.autoExpirePendingCancellations();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-5', staleBooking.date);
    });
  });
});
