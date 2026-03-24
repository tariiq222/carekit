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
import { ReminderService } from '../reminder.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

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
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);

    jest.clearAllMocks();
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
});
