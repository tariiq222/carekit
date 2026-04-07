/**
 * CareKit — ReminderService Unit Tests
 *
 * Tests the ReminderService in isolation:
 *   - sendDayBeforeReminders — finds confirmed bookings in 24h window
 *   - sendDayBeforeReminders — sends notifications to patient and practitioner
 *   - sendDayBeforeReminders — skips bookings without patientId
 *   - sendDayBeforeReminders — no notifications when no bookings found
 *   - sendHourBeforeReminders — finds confirmed bookings in 1h window
 *   - sendHourBeforeReminders — sends notification to patient only
 *
 * PrismaService and NotificationsService are mocked.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ReminderService } from '../../../src/modules/tasks/reminder.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { WhitelabelService } from '../../../src/modules/whitelabel/whitelabel.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaService: any = {
  booking: {
    findMany: jest.fn(),
  },
};

const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
};

const mockWhitelabelService = {
  getTimeFormat: jest.fn().mockResolvedValue('24h'),
  getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh'),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBookingWithBothParties = {
  id: 'booking-uuid-1',
  date: new Date('2026-04-01T09:00:00.000Z'),
  startTime: '09:00',
  patientId: 'patient-uuid-1',
  practitionerId: 'practitioner-uuid-1',
  practitioner: { userId: 'practitioner-user-uuid-1' },
};

const mockBookingWithoutPatient = {
  id: 'booking-uuid-2',
  date: new Date('2026-04-01T10:00:00.000Z'),
  startTime: '10:00',
  patientId: null,
  practitionerId: 'practitioner-uuid-2',
  practitioner: { userId: 'practitioner-user-uuid-2' },
};

const mockBookingForHourReminder = {
  id: 'booking-uuid-3',
  startTime: '14:00',
  patientId: 'patient-uuid-3',
};

const mockBookingForHourReminderNoPatient = {
  id: 'booking-uuid-4',
  startTime: '14:30',
  patientId: null,
};

/** Build a booking whose startTime is `offsetMinutes` from now — for time-sensitive tests */
function buildTimedBooking(offsetMinutes: number, patientId: string | null = 'patient-timed') {
  const now = new Date();
  const target = new Date(now.getTime() + offsetMinutes * 60_000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const today = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return {
    id: `booking-timed-${offsetMinutes}`,
    date: today,
    startTime: `${hh}:${mm}`,
    patientId,
    practitioner: patientId ? { userId: `prac-user-${offsetMinutes}` } : null,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ReminderService', () => {
  let service: ReminderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: WhitelabelService,
          useValue: mockWhitelabelService,
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);

    jest.clearAllMocks();
    mockWhitelabelService.getTimeFormat.mockResolvedValue('24h');
    mockWhitelabelService.getTimezone.mockResolvedValue('Asia/Riyadh');
  });

  // ─────────────────────────────────────────────────────────────
  // sendDayBeforeReminders
  // ─────────────────────────────────────────────────────────────

  describe('sendDayBeforeReminders', () => {
    it('should query for confirmed bookings in 24h window', async () => {
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
            select: { userId: true },
          },
        },
      });
    });

    it('should send notifications to both patient and practitioner', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingWithBothParties,
      ]);

      await service.sendDayBeforeReminders();

      // Patient notification
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patient-uuid-1',
          titleEn: 'Appointment Reminder — Tomorrow',
          type: 'booking_reminder',
          data: { bookingId: 'booking-uuid-1' },
        }),
      );

      // Practitioner notification
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'practitioner-user-uuid-1',
          titleEn: 'Appointment Reminder — Tomorrow',
          type: 'booking_reminder',
          data: { bookingId: 'booking-uuid-1' },
        }),
      );

      expect(
        mockNotificationsService.createNotification,
      ).toHaveBeenCalledTimes(2);
    });

    it('should skip patient notification when patientId is null', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingWithoutPatient,
      ]);

      await service.sendDayBeforeReminders();

      // Only practitioner notification should be sent
      expect(
        mockNotificationsService.createNotification,
      ).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'practitioner-user-uuid-2',
        }),
      );
    });

    it('should not send any notifications when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendDayBeforeReminders();

      expect(
        mockNotificationsService.createNotification,
      ).not.toHaveBeenCalled();
    });

    it('should include booking date and time in notification body', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingWithBothParties,
      ]);

      await service.sendDayBeforeReminders();

      const patientCall =
        mockNotificationsService.createNotification.mock.calls[0][0];
      expect(patientCall.bodyEn).toContain('09:00');
      expect(patientCall.bodyEn).toContain('2026-04-01');
    });

    it('should await all notification promises for sendDayBeforeReminders', async () => {
      let notifCallCount = 0;
      mockNotificationsService.createNotification.mockImplementation(() => {
        notifCallCount++;
        return Promise.resolve({});
      });
      mockWhitelabelService.getTimeFormat.mockResolvedValue('24h');
      mockPrismaService.booking.findMany.mockResolvedValue([
        {
          id: 'b-1',
          date: new Date('2026-04-08'),
          startTime: '10:00',
          patientId: 'patient-1',
          practitionerId: 'pract-1',
          practitioner: { userId: 'user-pract-1' },
        },
      ]);

      await service.sendDayBeforeReminders();

      expect(notifCallCount).toBe(2);
    });

    it('should handle multiple bookings in the window', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingWithBothParties,
        mockBookingWithoutPatient,
      ]);

      await service.sendDayBeforeReminders();

      // Booking 1: patient + practitioner = 2
      // Booking 2: practitioner only = 1
      // Total = 3
      expect(
        mockNotificationsService.createNotification,
      ).toHaveBeenCalledTimes(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendHourBeforeReminders
  // ─────────────────────────────────────────────────────────────

  describe('sendHourBeforeReminders', () => {
    it('should query for confirmed bookings in 1h window', async () => {
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

    it('should send notification to patient only', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingForHourReminder,
      ]);

      await service.sendHourBeforeReminders();

      expect(
        mockNotificationsService.createNotification,
      ).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patient-uuid-3',
          titleEn: 'Appointment in 1 Hour',
          type: 'booking_reminder',
          data: { bookingId: 'booking-uuid-3' },
        }),
      );
    });

    it('should skip bookings without patientId', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingForHourReminderNoPatient,
      ]);

      await service.sendHourBeforeReminders();

      expect(
        mockNotificationsService.createNotification,
      ).not.toHaveBeenCalled();
    });

    it('should not send any notifications when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendHourBeforeReminders();

      expect(
        mockNotificationsService.createNotification,
      ).not.toHaveBeenCalled();
    });

    it('should include start time in notification body', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingForHourReminder,
      ]);

      await service.sendHourBeforeReminders();

      const callDto =
        mockNotificationsService.createNotification.mock.calls[0][0];
      expect(callDto.bodyEn).toContain('14:00');
      expect(callDto.bodyAr).toContain('14:00');
    });

    it('should handle multiple bookings with mixed patientIds', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockBookingForHourReminder,
        mockBookingForHourReminderNoPatient,
        { id: 'booking-uuid-5', startTime: '15:00', patientId: 'patient-5' },
      ]);

      await service.sendHourBeforeReminders();

      // Only bookings with patientId get notifications: 2 out of 3
      expect(
        mockNotificationsService.createNotification,
      ).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendTwoHourReminders
  // ─────────────────────────────────────────────────────────────

  describe('sendTwoHourReminders', () => {
    it('should not send notifications when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendTwoHourReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should send notifications to patient and practitioner for bookings ~2h away', async () => {
      const booking = buildTimedBooking(120); // exactly 2h from now
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendTwoHourReminders();

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: booking.patientId,
          titleEn: 'Appointment in 2 Hours',
          type: 'booking_reminder',
        }),
      );
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: booking.practitioner!.userId,
          titleEn: 'Appointment in 2 Hours',
        }),
      );
    });

    it('should skip notification when booking is outside 90-150 min window', async () => {
      const booking = buildTimedBooking(30); // only 30 min away — outside window
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendTwoHourReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip patient notification when patientId is null', async () => {
      const booking = buildTimedBooking(120, null);
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendTwoHourReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // sendUrgentReminders
  // ─────────────────────────────────────────────────────────────

  describe('sendUrgentReminders', () => {
    it('should not send notifications when no bookings found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.sendUrgentReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should notify patient for bookings ~15 min away', async () => {
      const booking = buildTimedBooking(15); // 15 min away
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendUrgentReminders();

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: booking.patientId,
          titleEn: 'Appointment in 15 Minutes!',
          type: 'booking_reminder_urgent',
        }),
      );
    });

    it('should skip notification when booking is outside 10-20 min window', async () => {
      const booking = buildTimedBooking(60); // 60 min away — outside window
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendUrgentReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip notification when patientId is null', async () => {
      const booking = buildTimedBooking(15, null);
      mockPrismaService.booking.findMany.mockResolvedValue([booking]);

      await service.sendUrgentReminders();

      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });
  });
});
