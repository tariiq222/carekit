/**
 * BookingExpiryService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingExpiryService } from '../../../src/modules/tasks/booking-expiry.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../../src/modules/bookings/booking-status-log.service.js';
import { WaitlistService } from '../../../src/modules/bookings/waitlist.service.js';

const defaultSettings = {
  paymentTimeoutMinutes: 30,
};

const mockPrisma: any = {
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
};

const mockMessagingDispatcher = {
  dispatch: jest.fn().mockResolvedValue(undefined),
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
        { provide: MessagingDispatcherService, useValue: mockMessagingDispatcher },
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
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.payment.deleteMany.mockResolvedValue({});
    mockPrisma.booking.update.mockResolvedValue({});
    mockMessagingDispatcher.dispatch.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockWaitlist.checkAndNotify.mockResolvedValue(undefined);
    mockStatusLog.log.mockResolvedValue(undefined);
    // Default: execute transaction callback with same mock as tx context
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('filterSafeToExpire', () => {
    it('should use a single batched query instead of one per booking', async () => {
      const bookings = [
        { id: 'booking-1' },
        { id: 'booking-2' },
        { id: 'booking-3' },
      ];

      mockPrisma.payment.findMany.mockResolvedValue([
        { bookingId: 'booking-2' },
      ]);

      const result = await (service as any).filterSafeToExpire(bookings);

      expect(mockPrisma.payment.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          bookingId: { in: ['booking-1', 'booking-2', 'booking-3'] },
          status: { in: ['paid', 'pending'] },
        },
        select: { bookingId: true },
      });
      expect(result.map((b: { id: string }) => b.id)).toEqual([
        'booking-1',
        'booking-3',
      ]);
    });

    it('should return empty array if input is empty without querying DB', async () => {
      const result = await (service as any).filterSafeToExpire([]);
      expect(result).toEqual([]);
      expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('expirePendingBookings', () => {
    it('should do nothing when no expired bookings found', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should expire booking and notify patient', async () => {
      const booking = {
        id: 'b-1',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'in_person',
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
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'patient-1',
          event: MessagingEvent.BOOKING_EXPIRED,
        }),
      );
    });

    it('should skip notification when patientId is null', async () => {
      const booking = {
        id: 'b-2',
        patientId: null,
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'in_person',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should skip bookings that have an active payment', async () => {
      const booking = {
        id: 'b-3',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date(),
        type: 'in_person',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);
      // Active payment found in filterSafeToExpire (batched query)
      mockPrisma.payment.findMany.mockResolvedValue([{ bookingId: 'b-3' }]);

      await service.expirePendingBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should call waitlist checkAndNotify after expiry', async () => {
      const booking = {
        id: 'b-4',
        patientId: 'patient-1',
        practitionerId: 'pract-1',
        date: new Date('2026-05-01'),
        type: 'in_person',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);

      await service.expirePendingBookings();

      expect(mockWaitlist.checkAndNotify).toHaveBeenCalledWith(
        'pract-1',
        booking.date,
      );
    });

    it('should skip already-transitioned booking when re-check returns null', async () => {
      const booking = {
        id: 'b-5',
        patientId: 'patient-5',
        practitionerId: 'pract-5',
        date: new Date(),
        type: 'in_person',
        zoomMeetingId: null,
      };
      mockPrisma.booking.findMany.mockResolvedValue([booking]);
      // Re-check guard: booking already transitioned
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await service.expirePendingBookings();

      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
