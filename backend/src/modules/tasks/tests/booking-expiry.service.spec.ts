/**
 * BookingExpiryService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingExpiryService } from '../booking-expiry.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';
import { WaitlistService } from '../../bookings/waitlist.service.js';

const defaultSettings = {
  paymentTimeoutMinutes: 30,
};

const mockPrisma: Record<string, jest.Mock | Record<string, jest.Mock>> = {
  booking: {
    findMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    deleteMany: jest.fn().mockResolvedValue({}),
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
        { provide: WaitlistService, useValue: mockWaitlist },
      ],
    }).compile();

    service = module.get<BookingExpiryService>(BookingExpiryService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    (mockPrisma.payment as Record<string, jest.Mock>).findFirst.mockResolvedValue(null);
    (mockPrisma.payment as Record<string, jest.Mock>).deleteMany.mockResolvedValue({});
    (mockPrisma.booking as Record<string, jest.Mock>).update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
  });

  describe('expirePendingBookings', () => {
    it('should do nothing when no expired bookings found', async () => {
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([]);

      await service.expirePendingBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
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
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
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
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalled();
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
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([booking]);
      (mockPrisma.payment as Record<string, jest.Mock>).findFirst.mockResolvedValue({ id: 'pay-1' });

      await service.expirePendingBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
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
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-1', booking.date);
    });
  });
});
