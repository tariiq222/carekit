/**
 * CareKit — BookingsService Guard Tests
 *
 * Unit tests for:
 *   - isAcceptingBookings guard (practitioner not accepting bookings)
 *   - maxAdvanceBookingDays guard (booking too far in advance)
 *
 * Split from bookings.service.spec.ts to respect the 350-line file limit.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from '../../../src/modules/bookings/bookings.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { BookingCancellationService } from '../../../src/modules/bookings/booking-cancellation.service.js';
import { BookingQueryService } from '../../../src/modules/bookings/booking-query.service.js';
import { ZoomService } from '../../../src/modules/integrations/zoom/zoom.service.js';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { BookingStatusService } from '../../../src/modules/bookings/booking-status.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingPaymentHelper } from '../../../src/modules/bookings/booking-payment.helper.js';
import { PriceResolverService } from '../../../src/modules/bookings/price-resolver.service.js';
import { ClinicHoursService } from '../../../src/modules/clinic/clinic-hours.service.js';
import { ClinicHolidaysService } from '../../../src/modules/clinic/clinic-holidays.service.js';
import { BookingRescheduleService } from '../../../src/modules/bookings/booking-reschedule.service.js';
import { BookingCreationService } from '../../../src/modules/bookings/booking-creation.service.js';
import { ClinicSettingsService } from '../../../src/modules/clinic-settings/clinic-settings.service.js';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockPrismaService: any = {
  booking: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  practitioner: { findFirst: jest.fn(), findUnique: jest.fn() },
  service: { findFirst: jest.fn() },
  practitionerService: { findUnique: jest.fn() },
  practitionerAvailability: { findMany: jest.fn() },
  practitionerVacation: { findMany: jest.fn(), findFirst: jest.fn() },
  serviceBranch: {
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn(),
  },
  payment: { findFirst: jest.fn(), updateMany: jest.fn() },
  intakeForm: { findFirst: jest.fn().mockResolvedValue(null) },
  intakeResponse: { findFirst: jest.fn().mockResolvedValue(null) },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrismaService),
  ),
};

const mockZoomService = { createMeeting: jest.fn(), deleteMeeting: jest.fn() };
const mockCancellationService = {
  requestCancellation: jest.fn(),
  approveCancellation: jest.fn(),
  rejectCancellation: jest.fn(),
};
const mockQueryService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findMyBookings: jest.fn(),
  findTodayBookings: jest.fn(),
  getNextAvailableSlots: jest.fn().mockResolvedValue([]),
};
const mockNotificationsService = {
  createNotification: jest.fn().mockResolvedValue(undefined),
};
const mockActivityLogService = { log: jest.fn().mockResolvedValue(undefined) };

const defaultSettings = {
  maxAdvanceBookingDays: 60,
  minBookingLeadMinutes: 0,
  allowWalkIn: true,
  suggestAlternativesOnConflict: false,
  adminCanBookOutsideHours: false,
  bufferMinutes: 0,
  paymentTimeoutMinutes: 60,
};

const mockSettingsService = {
  get: jest.fn().mockResolvedValue(defaultSettings),
  getForBranch: jest.fn().mockImplementation(() => mockSettingsService.get()),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockPractitioner = {
  id: 'practitioner-uuid-1',
  userId: 'user-uuid-1',
  isActive: true,
  isAcceptingBookings: true,
  deletedAt: null,
};

const mockService = {
  id: 'service-uuid-1',
  price: 15000,
  duration: 30,
  isActive: true,
  deletedAt: null,
};

const mockPractitionerService = {
  id: 'ps-uuid-1',
  practitionerId: mockPractitioner.id,
  serviceId: mockService.id,
  isActive: true,
  availableTypes: ['in_person', 'online'],
  customDuration: null,
  bufferMinutes: 0,
};

const mockPatientId = 'patient-uuid-1';

/** Returns a date string N days from today (Riyadh midnight reference) */
function futureDateString(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

const baseDto = {
  practitionerId: mockPractitioner.id,
  serviceId: mockService.id,
  type: 'in_person' as const,
  startTime: '09:00',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BookingsService — Guard Tests', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        BookingCreationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ZoomService, useValue: mockZoomService },
        {
          provide: BookingCancellationService,
          useValue: mockCancellationService,
        },
        { provide: BookingQueryService, useValue: mockQueryService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: BookingSettingsService, useValue: mockSettingsService },
        {
          provide: BookingStatusService,
          useValue: {
            confirm: jest.fn(),
            complete: jest.fn(),
            checkIn: jest.fn(),
            startSession: jest.fn(),
            markNoShow: jest.fn(),
          },
        },
        { provide: ActivityLogService, useValue: mockActivityLogService },
        {
          provide: BookingPaymentHelper,
          useValue: {
            resolvePatientId: jest
              .fn()
              .mockImplementation((_caller: string, patientId?: string) =>
                Promise.resolve(patientId ?? _caller),
              ),
            createPaymentIfNeeded: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PriceResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue({
              price: 20000,
              duration: 30,
              source: 'service_type',
            }),
          },
        },
        {
          provide: ClinicHoursService,
          useValue: {
            getAll: jest.fn().mockResolvedValue(
              [0, 1, 2, 3, 4, 5, 6].map((d) => ({
                dayOfWeek: d,
                startTime: '08:00',
                endTime: '20:00',
                isActive: true,
              })),
            ),
            getForDay: jest.fn(),
          },
        },
        {
          provide: ClinicHolidaysService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            isHoliday: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: BookingRescheduleService,
          useValue: { reschedule: jest.fn() },
        },
        {
          provide: ClinicSettingsService,
          useValue: { getTimezone: jest.fn().mockResolvedValue('Asia/Riyadh') },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();

    // Reset settings to defaults after clearAllMocks
    mockSettingsService.get.mockResolvedValue({ ...defaultSettings });
  });

  // ─────────────────────────────────────────────────────────────
  // isAcceptingBookings guard
  // ─────────────────────────────────────────────────────────────

  describe('create - isAcceptingBookings guard', () => {
    it('throws NOT_ACCEPTING_BOOKINGS when practitioner.isAcceptingBookings is false', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue({
        ...mockPractitioner,
        isAcceptingBookings: false,
      });
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(
        mockPractitionerService,
      );

      await expect(
        service.create(mockPatientId, {
          ...baseDto,
          date: futureDateString(5),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(mockPatientId, {
          ...baseDto,
          date: futureDateString(5),
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ error: 'NOT_ACCEPTING_BOOKINGS' }),
      });
    });

    it('proceeds when practitioner.isAcceptingBookings is true', async () => {
      mockPrismaService.practitioner.findFirst.mockResolvedValue({
        ...mockPractitioner,
        isAcceptingBookings: true,
      });
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(
        mockPractitionerService,
      );
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true },
      ]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'new-booking',
        status: 'pending',
        zoomJoinUrl: null,
        zoomHostUrl: null,
      });

      const result = await service.create(mockPatientId, {
        ...baseDto,
        date: futureDateString(5),
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // maxAdvanceBookingDays guard
  // ─────────────────────────────────────────────────────────────

  describe('create - maxAdvanceBookingDays guard', () => {
    it('throws BOOKING_TOO_FAR_IN_ADVANCE when booking is beyond max window', async () => {
      mockSettingsService.get.mockResolvedValue({
        ...defaultSettings,
        maxAdvanceBookingDays: 30,
      });
      mockPrismaService.practitioner.findFirst.mockResolvedValue(
        mockPractitioner,
      );
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(
        mockPractitionerService,
      );

      await expect(
        service.create(mockPatientId, {
          ...baseDto,
          date: futureDateString(31),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(mockPatientId, {
          ...baseDto,
          date: futureDateString(31),
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'BOOKING_TOO_FAR_IN_ADVANCE',
        }),
      });
    });

    it('allows booking exactly at max window boundary', async () => {
      mockSettingsService.get.mockResolvedValue({
        ...defaultSettings,
        maxAdvanceBookingDays: 30,
      });
      mockPrismaService.practitioner.findFirst.mockResolvedValue(
        mockPractitioner,
      );
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(
        mockPractitionerService,
      );
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true },
      ]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'new-booking',
        status: 'pending',
        zoomJoinUrl: null,
        zoomHostUrl: null,
      });

      // Exactly 30 days ahead — should not throw
      const result = await service.create(mockPatientId, {
        ...baseDto,
        date: futureDateString(30),
      });

      expect(result).toBeDefined();
    });

    it('does not enforce limit when maxAdvanceBookingDays is 0', async () => {
      mockSettingsService.get.mockResolvedValue({
        ...defaultSettings,
        maxAdvanceBookingDays: 0,
      });
      mockPrismaService.practitioner.findFirst.mockResolvedValue(
        mockPractitioner,
      );
      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.practitionerService.findUnique.mockResolvedValue(
        mockPractitionerService,
      );
      mockPrismaService.practitionerAvailability.findMany.mockResolvedValue([
        { dayOfWeek: 0, startTime: '08:00', endTime: '18:00', isActive: true },
      ]);
      mockPrismaService.practitionerVacation.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.booking.create.mockResolvedValue({
        id: 'new-booking',
        status: 'pending',
        zoomJoinUrl: null,
        zoomHostUrl: null,
      });

      // 365 days ahead — should be allowed since maxAdvanceBookingDays = 0 means no limit
      const result = await service.create(mockPatientId, {
        ...baseDto,
        date: futureDateString(365),
      });

      expect(result).toBeDefined();
    });
  });
});
