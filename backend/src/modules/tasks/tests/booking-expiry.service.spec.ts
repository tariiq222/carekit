/**
 * BookingExpiryService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingExpiryService } from '../booking-expiry.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../bookings/booking-status-log.service.js';
import { WaitlistService } from '../../bookings/waitlist.service.js';

const defaultSettings = {
  paymentTimeoutMinutes: 30,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    deleteMany: jest.fn().mockResolvedValue({}),
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

describe('BookingExpiryService', () => {
  let service: BookingExpiryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingExpiryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingSettingsService, useValue: mockSettings },
        { provide: BookingStatusLogService, useValue: mockStatusLog },
        { provide: WaitlistService, useValue: mockWaitlist },
      ],
    }).compile();

    service = module.get<BookingExpiryService>(BookingExpiryService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    // Re-check guard: findFirst returns truthy by default (booking still pending)
    mockPrisma.booking.findFirst.mockResolvedValue({ id: 'stub' });
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockPrisma.payment.deleteMany.mockResolvedValue({});
    mockPrisma.booking.update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
    mockStatusLog.log.mockResolvedValue(undefined);
    // Default: execute transaction callback with same mock as tx context
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('expirePendingBookings', () => {
    it('should do nothing when no expired bookings found', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('should expire booking and notify patient', async () => {
      const booking = {
        id: 'b-1',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'clinic_visit',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-1' },
          data: expect.objectContaining({ status: 'expired' }),
        }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'patient-1', type: 'booking_expired' }),
      );
    });

    it('should skip notification when patientId is null', async () => {
      const booking = {
        id: 'b-2',
        patientId: null,
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'clinic_visit',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('should skip bookings that have an active payment', async () => {
      const booking = {
        id: 'b-3',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'clinic_visit',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);
      // Active payment found in filterSafeToExpire
      mockPrisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should call waitlist checkAndNotify after expiry', async () => {
      const booking = {
        id: 'b-4',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date('2026-05-01'),
        type: 'clinic_visit',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-1', booking.date);
    });

    it('should skip already-transitioned booking when re-check returns null', async () => {
      const booking = {
        id: 'b-5',
        patientId: 'patient-5',
        practitionerId: 'pract-5',
        date: new Date(),
        type: 'clinic_visit',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);
      // Re-check guard: booking already transitioned
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await service.expirePendingBookings();

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
