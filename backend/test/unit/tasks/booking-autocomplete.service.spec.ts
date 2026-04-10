/**
 * BookingAutocompleteService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingAutocompleteService } from '../../../src/modules/tasks/booking-autocomplete.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusLogService } from '../../../src/modules/bookings/booking-status-log.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';

const defaultSettings = {
  autoCompleteAfterHours: 2,
};

const mockPrisma: any = {
  booking: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
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

const mockStatusLog = {
  log: jest.fn().mockResolvedValue(undefined),
};

describe('BookingAutocompleteService', () => {
  let service: BookingAutocompleteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingAutocompleteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: BookingSettingsService, useValue: mockSettings },
        { provide: BookingStatusLogService, useValue: mockStatusLog },
        {
          provide: ClinicSettingsService,
          useValue: { getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh') },
        },
      ],
    }).compile();

    service = module.get<BookingAutocompleteService>(
      BookingAutocompleteService,
    );
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    // Re-check guard: findFirst returns truthy by default
    mockPrisma.booking.findFirst.mockResolvedValue({ id: 'stub' });
    mockPrisma.booking.update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
    mockStatusLog.log.mockResolvedValue(undefined);
    // Default: execute transaction callback with same mock as tx context
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  describe('autoCompleteBookings', () => {
    it('should do nothing when no candidates found', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      await service.autoCompleteBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should skip bookings that ended recently (within autoCompleteAfterHours)', async () => {
      // endTime 1 hour ago — not past the 2-hour threshold
      const recentDate = new Date();
      const recentBooking = {
        id: 'b-1',
        patientId: 'patient-1',
        status: 'confirmed',
        date: recentDate,
        endTime: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(Date.now() - 60 * 60 * 1000)),
      };
      mockPrisma.booking.findMany.mockResolvedValue([recentBooking]);

      await service.autoCompleteBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('should auto-complete old bookings and notify patient', async () => {
      // endTime 3 hours ago — past the 2-hour threshold
      const oldDate = new Date('2026-01-01T00:00:00+03:00');
      const oldBooking = {
        id: 'b-2',
        patientId: 'patient-2',
        status: 'confirmed',
        date: oldDate,
        endTime: '08:00',
      };
      mockPrisma.booking.findMany.mockResolvedValue([oldBooking]);

      await service.autoCompleteBookings();

      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-2' },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patient-2',
          type: 'booking_completed',
        }),
      );
    });

    it('should skip notification when patientId is null', async () => {
      const oldDate = new Date('2026-01-01T00:00:00+03:00');
      const oldBooking = {
        id: 'b-3',
        patientId: null,
        status: 'in_progress',
        date: oldDate,
        endTime: '08:00',
      };
      mockPrisma.booking.findMany.mockResolvedValue([oldBooking]);

      await service.autoCompleteBookings();

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('should skip already-transitioned booking when re-check returns null', async () => {
      const oldDate = new Date('2026-01-01T00:00:00+03:00');
      const oldBooking = {
        id: 'b-4',
        patientId: 'patient-4',
        status: 'confirmed',
        date: oldDate,
        endTime: '08:00',
      };
      mockPrisma.booking.findMany.mockResolvedValue([oldBooking]);
      // Re-check guard: booking already completed by another process
      mockPrisma.booking.findFirst.mockResolvedValue(null);

      await service.autoCompleteBookings();

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
