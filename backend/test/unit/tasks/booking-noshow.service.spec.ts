/**
 * BookingNoShowService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingNoShowService } from '../../../src/modules/tasks/booking-noshow.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../../src/modules/bookings/booking-status-log.service.js';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';
import { MoyasarRefundService } from '../../../src/modules/payments/moyasar-refund.service.js';
import { NoShowPolicy } from '@prisma/client';

const defaultSettings = {
  autoNoShowAfterMinutes: 30,
  noShowPolicy: NoShowPolicy.keep_full,
  noShowRefundPercent: 0,
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
  userRole: {
    findMany: jest.fn().mockResolvedValue([]),
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
        { provide: BookingStatusLogService, useValue: mockStatusLog },
        { provide: WaitlistService, useValue: mockWaitlist },
        { provide: MoyasarRefundService, useValue: mockMoyasarRefund },
      ],
    }).compile();

    service = module.get<BookingNoShowService>(BookingNoShowService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    // Re-check guard: findFirst returns truthy by default (booking still confirmed)
    mockPrisma.booking.findFirst.mockResolvedValue({ id: 'stub' });
    mockPrisma.booking.update.mockResolvedValue({});
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.payment.update.mockResolvedValue({});
    mockPrisma.userRole.findMany.mockResolvedValue([]);
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

  describe('autoNoShow', () => {
    it('should do nothing when no confirmed bookings found', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.autoNoShow();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should skip bookings that are still within no-show window', async () => {
      // Booking is tomorrow at 09:00 — well beyond the no-show deadline
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureBooking = {
        id: 'b-1',
        startTime: '09:00',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: tomorrow,
        practitioner: { userId: 'user-pract-1' },
      };
      mockPrisma.booking.findMany.mockResolvedValue([futureBooking]);

      await service.autoNoShow();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
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
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
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
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);

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
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);

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
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-5',
        status: 'paid',
        method: 'bank_transfer',
        totalAmount: 10000,
      });

      await service.autoNoShow();

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'refunded', refundAmount: 5000 }),
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
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);

      await service.autoNoShow();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith('pract-6', pastDate);
    });

    it('should skip already-transitioned booking when re-check returns null', async () => {
      const pastBooking = {
        id: 'b-7',
        startTime: '08:00',
        patientId: 'patient-7',
        practitionerId: 'pract-7',
        date: new Date('2026-01-01T00:00:00+03:00'),
        practitioner: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([pastBooking]);
      // Re-check guard: booking already checked-in or cancelled
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await service.autoNoShow();

      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
