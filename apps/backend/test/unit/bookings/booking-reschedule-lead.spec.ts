/**
 * Unit test: minBookingLeadMinutes enforcement on reschedule
 * Bug fix: lead time was not checked during reschedule — only during creation
 */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingRescheduleService } from '../../../src/modules/bookings/booking-reschedule.service.js';
import { BookingSettingsService } from '../../../src/modules/bookings/booking-settings.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { ZoomService } from '../../../src/modules/integrations/zoom/zoom.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { ActivityLogService } from '../../../src/modules/activity-log/activity-log.service.js';
import { BookingQueryService } from '../../../src/modules/bookings/booking-query.service.js';

const BOOKING_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PRACTITIONER_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const SERVICE_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const PS_ID = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

function makeBooking(overrides = {}) {
  return {
    id: BOOKING_ID,
    practitionerId: PRACTITIONER_ID,
    serviceId: SERVICE_ID,
    practitionerServiceId: PS_ID,
    branchId: null,
    type: 'in_person',
    status: 'confirmed',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    startTime: '10:00',
    endTime: '10:30',
    bookedDuration: 30,
    bookedPrice: 100,
    zoomMeetingId: null,
    notes: null,
    durationOptionId: null,
    recurringGroupId: null,
    rescheduleCount: 0,
    ...overrides,
  };
}

describe('BookingRescheduleService — minBookingLeadMinutes', () => {
  let service: BookingRescheduleService;
  let mockPrisma: any;
  let mockSettingsService: any;

  beforeEach(async () => {
    mockPrisma = {
      booking: {
        findFirst: jest.fn().mockResolvedValue(makeBooking()),
      },
      practitionerService: {
        findUnique: jest.fn().mockResolvedValue({
          id: PS_ID,
          bufferMinutes: 0,
          customDuration: null,
        }),
      },
      service: {
        findFirst: jest.fn().mockResolvedValue({
          id: SERVICE_ID,
          duration: 30,
          bufferMinutes: 0,
        }),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockPrisma)),
      practitionerAvailability: { findMany: jest.fn().mockResolvedValue([]) },
      practitionerVacation: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    mockSettingsService = {
      getForBranch: jest.fn().mockResolvedValue({
        minBookingLeadMinutes: 120,
        maxReschedulesPerBooking: 5,
        patientCanReschedule: true,
        rescheduleBeforeHours: 0,
        adminCanBookOutsideHours: false,
        bufferMinutes: 0,
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BookingRescheduleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BookingSettingsService, useValue: mockSettingsService },
        {
          provide: ZoomService,
          useValue: { createMeeting: jest.fn(), deleteMeeting: jest.fn() },
        },
        {
          provide: MessagingDispatcherService,
          useValue: { dispatch: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ActivityLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: BookingQueryService, useValue: {} },
      ],
    }).compile();

    service = module.get(BookingRescheduleService);
  });

  it('should REJECT reschedule to a slot 30 min from now when lead=120', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const date = soon.toISOString().split('T')[0];
    const h = String(soon.getHours()).padStart(2, '0');
    const m = String(soon.getMinutes()).padStart(2, '0');
    const startTime = `${h}:${m}`;

    await expect(
      service.reschedule(BOOKING_ID, { date, startTime }, 'admin-id'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.reschedule(BOOKING_ID, { date, startTime }, 'admin-id'),
    ).rejects.toMatchObject({
      response: { error: 'BOOKING_LEAD_TIME_VIOLATION' },
    });
  });

  it('should ALLOW reschedule to a slot 3 hours from now when lead=120', async () => {
    // Build date + time that is 3 hours from now using local time (matching how service parses it)
    const future = new Date(Date.now() + 3 * 60 * 60 * 1000);
    // Format date in local timezone (YYYY-MM-DD)
    const localDate = new Date(
      future.getTime() - future.getTimezoneOffset() * 60000,
    );
    const date = localDate.toISOString().split('T')[0];
    const h = String(future.getHours()).padStart(2, '0');
    const mm = String(future.getMinutes()).padStart(2, '0');
    const startTime = `${h}:${mm}`;

    // Provide availability slot so validateAvailability passes inside transaction
    mockPrisma.practitionerAvailability.findMany.mockResolvedValue([
      {
        dayOfWeek: future.getDay(),
        startTime: '00:00',
        endTime: '23:59',
        isActive: true,
        branchId: null,
      },
    ]);
    // booking.findMany needed by checkDoubleBooking
    mockPrisma.booking.findMany = jest.fn().mockResolvedValue([]);
    // booking.create + booking.update + payment.updateMany needed by transaction body
    mockPrisma.booking.create = jest
      .fn()
      .mockResolvedValue(
        makeBooking({ id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee' }),
      );
    mockPrisma.booking.update = jest.fn().mockResolvedValue({});
    mockPrisma.payment = { updateMany: jest.fn().mockResolvedValue({}) };
    mockPrisma.practitioner = {
      findUnique: jest.fn().mockResolvedValue({ userId: null }),
    };

    // Should NOT throw BOOKING_LEAD_TIME_VIOLATION
    try {
      await service.reschedule(BOOKING_ID, { date, startTime }, 'admin-id');
    } catch (err: any) {
      expect(err?.response?.error).not.toBe('BOOKING_LEAD_TIME_VIOLATION');
    }
  });

  it('should SKIP lead time check for admin with adminCanBookOutsideHours=true', async () => {
    mockSettingsService.getForBranch.mockResolvedValue({
      minBookingLeadMinutes: 120,
      maxReschedulesPerBooking: 5,
      patientCanReschedule: true,
      rescheduleBeforeHours: 0,
      adminCanBookOutsideHours: true, // admin override
      bufferMinutes: 0,
    });

    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const date = soon.toISOString().split('T')[0];
    const h = String(soon.getHours()).padStart(2, '0');
    const m = String(soon.getMinutes()).padStart(2, '0');
    const startTime = `${h}:${m}`;

    const newBooking = makeBooking({
      id: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
      date: soon,
      startTime,
    });
    mockPrisma.$transaction.mockResolvedValueOnce(newBooking);
    mockPrisma.practitioner = {
      findUnique: jest.fn().mockResolvedValue({ userId: null }),
    };

    // Should NOT throw BOOKING_LEAD_TIME_VIOLATION (admin override)
    try {
      await service.reschedule(BOOKING_ID, { date, startTime }, 'admin-id');
    } catch (err: any) {
      expect(err?.response?.error).not.toBe('BOOKING_LEAD_TIME_VIOLATION');
    }
  });
});
