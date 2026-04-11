/**
 * CareKit — ReminderService Unit Tests
 *
 * Tests ReminderService with MessagingDispatcherService:
 *   - sendDayBeforeReminders — notifies patient + practitioner for bookings ~24h away
 *   - sendDayBeforeReminders — skips patient when patientId is null
 *   - sendDayBeforeReminders — no dispatch when no bookings
 *   - sendHourBeforeReminders — notifies patient only for bookings ~1h away
 *   - sendHourBeforeReminders — skips when patientId is null
 *   - sendUrgentReminders — notifies patient only for bookings ~15min away
 *   - formatTimeForNotification — converts to 12h when clinic setting is 12h
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from '../../../src/modules/tasks/reminder.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { MessagingEvent } from '../../../src/modules/messaging/core/messaging-events.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  booking: { findMany: jest.fn() },
};

const mockMessagingDispatcher = {
  dispatch: jest.fn().mockResolvedValue(undefined),
};

const mockClinicSettingsService = {
  getTimeFormat: jest.fn().mockResolvedValue('24h'),
  getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh'),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const makeBookingWithBothParties = () => ({
  id: 'booking-uuid-1',
  date: new Date('2026-04-01T09:00:00.000Z'),
  startTime: '09:00',
  patientId: 'patient-uuid-1',
  practitionerId: 'practitioner-uuid-1',
  practitioner: {
    userId: 'practitioner-user-uuid-1',
    user: { firstName: 'أحمد', lastName: 'العلي' },
  },
});

const makeBookingWithoutPatient = () => ({
  id: 'booking-uuid-2',
  date: new Date('2026-04-01T10:00:00.000Z'),
  startTime: '10:00',
  patientId: null,
  practitionerId: 'practitioner-uuid-2',
  practitioner: {
    userId: 'practitioner-user-uuid-2',
    user: { firstName: 'سارة', lastName: 'محمد' },
  },
});

const makeHourBooking = () => ({
  id: 'booking-uuid-3',
  startTime: '14:00',
  patientId: 'patient-uuid-3',
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ReminderService', () => {
  let service: ReminderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MessagingDispatcherService, useValue: mockMessagingDispatcher },
        { provide: ClinicSettingsService, useValue: mockClinicSettingsService },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);

    jest.clearAllMocks();
    mockClinicSettingsService.getTimeFormat.mockResolvedValue('24h');
    mockClinicSettingsService.getTimezone.mockResolvedValue('Asia/Riyadh');
    mockMessagingDispatcher.dispatch.mockResolvedValue(undefined);
  });

  // ─── sendDayBeforeReminders ────────────────────────────────────────────────

  describe('sendDayBeforeReminders', () => {
    it('should query confirmed bookings in 24h window', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendDayBeforeReminders();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith({
        where: {
          status: 'confirmed',
          deletedAt: null,
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          patientId: true,
          practitionerId: true,
          practitioner: {
            select: {
              userId: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
    });

    it('should dispatch BOOKING_REMINDER to both patient and practitioner', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        makeBookingWithBothParties(),
      ]);

      await service.sendDayBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          event: MessagingEvent.BOOKING_REMINDER,
          recipientUserId: 'patient-uuid-1',
        }),
      );
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          event: MessagingEvent.BOOKING_REMINDER,
          recipientUserId: 'practitioner-user-uuid-1',
        }),
      );
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledTimes(2);
    });

    it('should skip patient dispatch when patientId is null', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        makeBookingWithoutPatient(),
      ]);

      await service.sendDayBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: 'practitioner-user-uuid-2',
        }),
      );
    });

    it('should not dispatch when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendDayBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should include date and time in context', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        makeBookingWithBothParties(),
      ]);

      await service.sendDayBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            time: '09:00',
          }),
        }),
      );
    });
  });

  // ─── sendHourBeforeReminders ───────────────────────────────────────────────

  describe('sendHourBeforeReminders', () => {
    it('should query confirmed bookings in 1h window', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendHourBeforeReminders();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith({
        where: {
          status: 'confirmed',
          deletedAt: null,
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        select: {
          id: true,
          startTime: true,
          patientId: true,
        },
      });
    });

    it('should dispatch BOOKING_REMINDER to patient only', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([makeHourBooking()]);

      await service.sendHourBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          event: MessagingEvent.BOOKING_REMINDER,
          recipientUserId: 'patient-uuid-3',
        }),
      );
    });

    it('should skip when patientId is null', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        { id: 'b-x', startTime: '14:00', patientId: null },
      ]);

      await service.sendHourBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should not dispatch when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendHourBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  // ─── formatTimeForNotification (via sendHourBeforeReminders) ───────────────

  describe('time formatting', () => {
    it('should return 24h time unchanged when format is 24h', async () => {
      mockClinicSettingsService.getTimeFormat.mockResolvedValue('24h');
      mockPrismaService.booking.findMany.mockResolvedValue([makeHourBooking()]);

      await service.sendHourBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ time: '14:00' }),
        }),
      );
    });

    it('should convert to 12h format when clinic setting is 12h', async () => {
      mockClinicSettingsService.getTimeFormat.mockResolvedValue('12h');
      mockPrismaService.booking.findMany.mockResolvedValue([makeHourBooking()]);

      await service.sendHourBeforeReminders();

      expect(mockMessagingDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ time: '2:00 م' }),
        }),
      );
    });
  });
});
