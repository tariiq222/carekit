/**
 * BookingNoShowService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingNoShowService } from '../booking-noshow.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';
import { WaitlistService } from '../../bookings/waitlist.service.js';
import { NoShowPolicy } from '@prisma/client';

const defaultSettings = {
  autoNoShowAfterMinutes: 30,
  noShowPolicy: NoShowPolicy.keep_full,
  noShowRefundPercent: 0,
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
  userRole: {
    findMany: jest.fn().mockResolvedValue([]),
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

describe('BookingNoShowService', () => {
  let service: BookingNoShowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingNoShowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingSettingsService, useValue: mockSettings },
        { provide: WaitlistService, useValue: mockWaitlist },
      ],
    }).compile();

    service = module.get<BookingNoShowService>(BookingNoShowService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    (mockPrisma.booking as Record<string, jest.Mock>).update.mockResolvedValue({});
    (mockPrisma.payment as Record<string, jest.Mock>).findUnique.mockResolvedValue(null);
    (mockPrisma.payment as Record<string, jest.Mock>).update.mockResolvedValue({});
    (mockPrisma.userRole as Record<string, jest.Mock>).findMany.mockResolvedValue([]);
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
  });

  describe('autoNoShow', () => {
    it('should do nothing when no confirmed bookings found', async () => {
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([]);

      await service.autoNoShow();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should skip bookings that are still within no-show window', async () => {
      // Booking end time is in the future — not past the no-show deadline
      const now = new Date();
      const futureBooking = {
        id: 'b-1',
        startTime: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: now,
        practitioner: { userId: 'user-pract-1' },
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([futureBooking]);

      await service.autoNoShow();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should mark past bookings as no_show', async () => {
      const pastDate = new Date('2026-01-01T00:00:00+03:00');
      const pastBooking = {
        id: 'b-2',
        startTime: '08:00',
        patientId: 'patient-2',
        practitionerId: 'pract-2',
        date: pastDate,
        practitioner: { userId: 'user-pract-2' },
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-2' },
          data: expect.objectContaining({ status: 'no_show' }),
        }),
      );
    });

    it('should notify practitioner when userId is available', async () => {
      const pastBooking = {
        id: 'b-3',
        startTime: '08:00',
        patientId: 'patient-3',
        practitionerId: 'pract-3',
        date: new Date('2026-01-01T00:00:00+03:00'),
        practitioner: { userId: 'user-pract-3' },
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-pract-3', type: 'booking_no_show' }),
      );
    });

    it('should notify patient about no-show', async () => {
      const pastBooking = {
        id: 'b-4',
        startTime: '08:00',
        patientId: 'patient-4',
        practitionerId: 'pract-4',
        date: new Date('2026-01-01T00:00:00+03:00'),
        practitioner: null,
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'patient-4', type: 'booking_no_show' }),
      );
    });

    it('should process partial refund when policy is partial_refund', async () => {
      mockSettings.get.mockResolvedValue({
        ...defaultSettings,
        noShowPolicy: NoShowPolicy.partial_refund,
        noShowRefundPercent: 50,
      });
      const pastBooking = {
        id: 'b-5',
        startTime: '08:00',
        patientId: 'patient-5',
        practitionerId: 'pract-5',
        date: new Date('2026-01-01T00:00:00+03:00'),
        practitioner: null,
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([pastBooking]);
      (mockPrisma.payment as Record<string, jest.Mock>).findUnique.mockResolvedValue({
        id: 'pay-5',
        status: 'paid',
        totalAmount: 10000,
      });

      await service.autoNoShow();

      expect((mockPrisma.payment as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'refunded', refundAmount: 5000 },
        }),
      );
    });

    it('should call waitlist checkAndNotify after no-show', async () => {
      const pastDate = new Date('2026-01-01T00:00:00+03:00');
      const pastBooking = {
        id: 'b-6',
        startTime: '08:00',
        patientId: null,
        practitionerId: 'pract-6',
        date: pastDate,
        practitioner: null,
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-6', pastDate);
    });
  });
});
