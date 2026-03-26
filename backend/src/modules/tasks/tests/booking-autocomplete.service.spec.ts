/**
 * BookingAutocompleteService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingAutocompleteService } from '../booking-autocomplete.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ActivityLogService } from '../../activity-log/activity-log.service.js';
import { BookingSettingsService } from '../../bookings/booking-settings.service.js';

const defaultSettings = {
  autoCompleteAfterHours: 2,
};

const mockPrisma: Record<string, jest.Mock | Record<string, jest.Mock>> = {
  booking: {
    findMany: jest.fn(),
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
      ],
    }).compile();

    service = module.get<BookingAutocompleteService>(BookingAutocompleteService);
    jest.clearAllMocks();
    mockSettings.get.mockResolvedValue(defaultSettings);
    (mockPrisma.booking as Record<string, jest.Mock>).update.mockResolvedValue({});
    mockNotifications.createNotification.mockResolvedValue(undefined);
    mockActivityLog.log.mockResolvedValue(undefined);
  });

  describe('autoCompleteBookings', () => {
    it('should do nothing when no candidates found', async () => {
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([]);

      await service.autoCompleteBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should skip bookings that ended recently (within autoCompleteAfterHours)', async () => {
      // endTime 1 hour ago — not past the 2-hour threshold
      const recentDate = new Date();
      const recentBooking = {
        id: 'b-1',
        patientId: 'patient-1',
        date: recentDate,
        endTime: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(Date.now() - 60 * 60 * 1000)),
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([recentBooking]);

      await service.autoCompleteBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
    });

    it('should auto-complete old bookings and notify patient', async () => {
      // endTime 3 hours ago — past the 2-hour threshold
      const oldDate = new Date('2026-01-01T00:00:00+03:00');
      const oldBooking = {
        id: 'b-2',
        patientId: 'patient-2',
        date: oldDate,
        endTime: '08:00',
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([oldBooking]);

      await service.autoCompleteBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-2' },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
      expect(mockNotifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'patient-2', type: 'booking_completed' }),
      );
    });

    it('should skip notification when patientId is null', async () => {
      const oldDate = new Date('2026-01-01T00:00:00+03:00');
      const oldBooking = {
        id: 'b-3',
        patientId: null,
        date: oldDate,
        endTime: '08:00',
      };
      (mockPrisma.booking as Record<string, jest.Mock>).findMany.mockResolvedValue([oldBooking]);

      await service.autoCompleteBookings();

      expect((mockPrisma.booking as Record<string, jest.Mock>).update).toHaveBeenCalled();
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });
  });
});
