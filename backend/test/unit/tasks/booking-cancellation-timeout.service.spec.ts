/**
 * BookingCancellationTimeoutService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingCancellationTimeoutService } from '../../../src/modules/tasks/booking-cancellation-timeout.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../../src/modules/bookings/booking-status-log.service.js';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';
import { MoyasarRefundService } from '../../../src/modules/payments/moyasar-refund.service.js';

const defaultSettings = {
  cancellationReviewTimeoutHours: 24,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
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

const mockStatusLog = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockMoyasarRefund = {
  refund: jest.fn().mockResolvedValue(undefined),
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
        { provide: BookingStatusLogService, useValue: mockStatusLog },
        { provide: WaitlistService, useValue: mockWaitlist },
        { provide: MoyasarRefundService, useValue: mockMoyasarRefund },
      ],
    }).compile();

    service = module.get<BookingCancellationTimeoutService>(BookingCancellationTimeoutService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    // Re-check guard: findFirst returns truthy (booking still pending_cancellation)
    mockPrisma.booking.findFirst.mockResolvedValue({ id: 'stub' });
    mockPrisma.booking.update.mockResolvedValue({});
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.payment.update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
    mockStatusLog.log.mockResolvedValue(undefined);
    mockMoyasarRefund.refund.mockResolvedValue(undefined);
    // Default: execute transaction callback with same mock as tx context
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('autoExpirePendingCancellations', () => {
    it('should do nothing when no stale cancellations', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.autoExpirePendingCancellations();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should cancel stale pending_cancellation bookings', async () => {
      const staleBooking = {
        id: 'b-1',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date('2026-04-01'),
      };
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);

      await service.autoExpirePendingCancellations();

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
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
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'paid',
        method: 'bank_transfer',
        totalAmount: 10000,
      });

      await service.autoExpirePendingCancellations();

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: 'refunded', refundAmount: 10000 }),
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
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-2',
        status: 'awaiting',
        method: 'bank_transfer',
        totalAmount: 10000,
      });

      await service.autoExpirePendingCancellations();

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should notify patient when patientId is set', async () => {
      const staleBooking = {
        id: 'b-4',
        patientId: 'patient-4',
        practitionerId: 'pract-1',
        date: new Date(),
      };
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);

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
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);

      await service.autoExpirePendingCancellations();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-5', staleBooking.date);
    });

    it('should skip already-processed booking when re-check returns null', async () => {
      const staleBooking = {
        id: 'b-6',
        patientId: 'patient-6',
        practitionerId: 'pract-6',
        date: new Date(),
      };
      mockPrisma.booking.findMany.mockResolvedValue([staleBooking]);
      // Re-check guard: booking already processed
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await service.autoExpirePendingCancellations();

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
