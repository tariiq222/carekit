import { ConflictException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { GetBookingSettingsHandler, DEFAULT_BOOKING_SETTINGS } from './get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from './upsert-booking-settings/upsert-booking-settings.handler';
import { CreateBookingHandler } from './create-booking/create-booking.handler';
import { CancelBookingHandler } from './cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from './reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from './confirm-booking/confirm-booking.handler';
import { AddToWaitlistHandler } from './add-to-waitlist/add-to-waitlist.handler';
import { GetBookingHandler } from './get-booking/get-booking.handler';
import { ListBookingsHandler } from './list-bookings/list-bookings.handler';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { CheckInBookingHandler } from './check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from './complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from './no-show-booking/no-show-booking.handler';
import { ExpireBookingHandler } from './expire-booking/expire-booking.handler';
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';

const future = new Date(Date.now() + 86400_000);
const past = new Date(Date.now() - 86400_000);

const mockBooking = {
  id: 'book-1', tenantId: 'tenant-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: future, endsAt: new Date(future.getTime() + 3600_000),
  durationMins: 60, price: 200, currency: 'SAR',
  status: BookingStatus.PENDING, bookingType: 'INDIVIDUAL',
};

const buildPrisma = () => ({
  booking: {
    findUnique: jest.fn().mockResolvedValue(mockBooking),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockBooking),
    update: jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
  },
  bookingStatusLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
  },
  $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  waitlistEntry: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'wl-1', status: 'WAITING' }),
  },
  businessHour: {
    findUnique: jest.fn().mockResolvedValue({
      branchId: 'branch-1', dayOfWeek: future.getDay(),
      startTime: '09:00', endTime: '17:00', isOpen: true,
    }),
  },
  holiday: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  employeeAvailability: {
    findMany: jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', dayOfWeek: future.getDay(), startTime: '09:00', endTime: '17:00', isActive: true },
    ]),
  },
  employeeAvailabilityException: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  service: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'svc-1', tenantId: 'tenant-1', durationMins: 60, price: 200, currency: 'SAR',
    }),
  },
  employee: {
    findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', tenantId: 'tenant-1' }),
  },
  employeeService: {
    findUnique: jest.fn().mockResolvedValue({ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1' }),
  },
});

const buildPriceResolver = () => ({
  resolve: jest.fn().mockResolvedValue({
    price: 200, durationMins: 60, durationOptionId: '', currency: 'SAR', isEmployeeOverride: false,
  }),
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

// ─── CreateBookingHandler ────────────────────────────────────────────────────
describe('CreateBookingHandler', () => {
  it('creates booking with price and duration derived from Service', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
      tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
      employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future,
    });
    expect(result.id).toBe('book-1');
    // price and durationMins come from service mock, not from DTO
    expect(prisma.service.findUnique).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
  });

  it('throws ConflictException on overlapping slot', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException for past scheduledAt', async () => {
    await expect(
      new CreateBookingHandler(buildPrisma() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: past,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when service does not exist', async () => {
    const prisma = buildPrisma();
    prisma.service.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'bad-svc', scheduledAt: future,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when service belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.service.findUnique = jest.fn().mockResolvedValue({
      id: 'svc-1', tenantId: 'other-tenant', durationMins: 60, price: 200, currency: 'SAR',
    });
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'bad-emp', serviceId: 'svc-1', scheduledAt: future,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when employee belongs to different tenant', async () => {
    const prisma = buildPrisma();
    prisma.employee.findUnique = jest.fn().mockResolvedValue({ id: 'emp-1', tenantId: 'other-tenant' });
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when employee does not provide the service', async () => {
    const prisma = buildPrisma();
    prisma.employeeService.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CreateBookingHandler(prisma as never, buildPriceResolver() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── CancelBookingHandler ────────────────────────────────────────────────────
describe('CancelBookingHandler', () => {
  it('cancels PENDING booking and emits event', async () => {
    const prisma = buildPrisma();
    const eb = buildEventBus();
    const result = await new CancelBookingHandler(prisma as never, eb as never).execute({
      tenantId: 'tenant-1', bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-42',
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancelled', expect.anything());
    expect(result.status).toBe(BookingStatus.CONFIRMED); // mock returns CONFIRMED
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'bad', reason: CancellationReason.OTHER, changedBy: 'user-42',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when booking is already CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1', reason: CancellationReason.OTHER, changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── RescheduleBookingHandler ────────────────────────────────────────────────
describe('RescheduleBookingHandler', () => {
  const newFuture = new Date(Date.now() + 172800_000);

  it('reschedules booking when new slot is free', async () => {
    const prisma = buildPrisma();
    await new RescheduleBookingHandler(prisma as never).execute({
      tenantId: 'tenant-1', bookingId: 'book-1', newScheduledAt: newFuture,
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ scheduledAt: newFuture }) }),
    );
  });

  it('throws BadRequestException when booking is COMPLETED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new RescheduleBookingHandler(prisma as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1', newScheduledAt: newFuture,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── ConfirmBookingHandler ───────────────────────────────────────────────────
describe('ConfirmBookingHandler', () => {
  it('confirms PENDING booking and emits BookingConfirmedEvent', async () => {
    const prisma = buildPrisma();
    const eb = buildEventBus();
    await new ConfirmBookingHandler(prisma as never, eb as never).execute({
      tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42',
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.confirmed', expect.anything());
  });

  it('throws BadRequestException when booking is already CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      new ConfirmBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── AddToWaitlistHandler ────────────────────────────────────────────────────
describe('AddToWaitlistHandler', () => {
  it('adds client to waitlist', async () => {
    const prisma = buildPrisma();
    const result = await new AddToWaitlistHandler(prisma as never).execute({
      tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'emp-1',
      serviceId: 'svc-1', branchId: 'branch-1',
    });
    expect(result.status).toBe('WAITING');
  });

  it('throws ConflictException when already on waitlist', async () => {
    const prisma = buildPrisma();
    prisma.waitlistEntry.findFirst = jest.fn().mockResolvedValue({ id: 'wl-1' });
    await expect(
      new AddToWaitlistHandler(prisma as never).execute({
        tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'emp-1',
        serviceId: 'svc-1', branchId: 'branch-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

// ─── GetBookingHandler ───────────────────────────────────────────────────────
describe('GetBookingHandler', () => {
  it('returns booking', async () => {
    const prisma = buildPrisma();
    const result = await new GetBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1' });
    expect(result.id).toBe('book-1');
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new GetBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'bad' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── ListBookingsHandler ─────────────────────────────────────────────────────
describe('ListBookingsHandler', () => {
  it('returns paginated bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([mockBooking]);
    const result = await new ListBookingsHandler(prisma as never).execute({
      tenantId: 'tenant-1', page: 1, limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

// ─── CheckInBookingHandler ───────────────────────────────────────────────────
describe('CheckInBookingHandler', () => {
  it('sets checkedInAt on CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CheckInBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ checkedInAt: expect.any(Date) }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new CheckInBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when already checked in', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: new Date() });
    await expect(
      new CheckInBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CheckInBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── CompleteBookingHandler ──────────────────────────────────────────────────
describe('CompleteBookingHandler', () => {
  it('completes CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CompleteBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.COMPLETED }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CompleteBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CompleteBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── NoShowBookingHandler ────────────────────────────────────────────────────
describe('NoShowBookingHandler', () => {
  it('marks CONFIRMED booking as NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new NoShowBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.NO_SHOW }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new NoShowBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new NoShowBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── ExpireBookingHandler ────────────────────────────────────────────────────
describe('ExpireBookingHandler', () => {
  it('expires PENDING booking', async () => {
    const prisma = buildPrisma();
    await new ExpireBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
    );
  });

  it('throws BadRequestException when booking is not PENDING', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      new ExpireBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new ExpireBookingHandler(prisma as never).execute({ tenantId: 'tenant-1', bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── CheckAvailabilityHandler ────────────────────────────────────────────────
describe('CheckAvailabilityHandler', () => {
  const tomorrowMidnight = new Date(future);
  tomorrowMidnight.setHours(0, 0, 0, 0);

  it('returns available slots when employee has a shift covering the day', async () => {
    const result = await new CheckAvailabilityHandler(buildPrisma() as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array when branch is closed', async () => {
    const prisma = buildPrisma();
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({ isOpen: false });
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when employee has no shifts on this day (weekly off)', async () => {
    const prisma = buildPrisma();
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([]);
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when a holiday exists for the branch on that date', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findFirst = jest.fn().mockResolvedValue({ id: 'hol-1', branchId: 'branch-1', date: tomorrowMidnight });
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when an exception covers the requested date', async () => {
    const prisma = buildPrisma();
    const yesterday = new Date(tomorrowMidnight);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayAfter = new Date(tomorrowMidnight);
    dayAfter.setDate(dayAfter.getDate() + 1);
    prisma.employeeAvailabilityException.findFirst = jest.fn().mockResolvedValue({
      id: 'exc-1', employeeId: 'emp-1', startDate: yesterday, endDate: dayAfter,
    });
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });
    expect(result).toEqual([]);
  });

  it('generates slots from both windows for a split shift with no slots in the gap', async () => {
    const prisma = buildPrisma();
    // Branch: 08:00-22:00. Employee: 09:00-13:00 and 16:00-21:00.
    // Slots should appear in 09:00-13:00 and 16:00-21:00 only.
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
      branchId: 'branch-1', dayOfWeek: tomorrowMidnight.getDay(),
      startTime: '08:00', endTime: '22:00', isOpen: true,
    });
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '09:00', endTime: '13:00', isActive: true },
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '16:00', endTime: '21:00', isActive: true },
    ]);

    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });

    const hours = result.map((s) => s.startTime.getHours());
    // All slots start inside shift windows
    expect(hours.every((h) => (h >= 9 && h < 13) || (h >= 16 && h < 21))).toBe(true);
    // No slot starts in the gap (13:00-16:00)
    expect(hours.some((h) => h >= 13 && h < 16)).toBe(false);
    expect(result.length).toBeGreaterThan(0);
  });

  it('clamps slot window to branch hours when shift exceeds them', async () => {
    const prisma = buildPrisma();
    // Branch: 09:00-17:00. Employee shift: 08:00-18:00.
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({
      branchId: 'branch-1', dayOfWeek: tomorrowMidnight.getDay(),
      startTime: '09:00', endTime: '17:00', isOpen: true,
    });
    prisma.employeeAvailability.findMany = jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', dayOfWeek: tomorrowMidnight.getDay(), startTime: '08:00', endTime: '18:00', isActive: true },
    ]);

    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowMidnight, durationMins: 60,
    });

    // No slot should start before 09:00 or end after 17:00
    expect(result.every((s) => s.startTime.getHours() >= 9)).toBe(true);
    expect(result.every((s) => s.endTime <= new Date(tomorrowMidnight.getTime() + 17 * 3600_000))).toBe(true);
  });
});

describe('ConfirmBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on confirm', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new ConfirmBookingHandler(prisma as never, eventBus as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        bookingId: 'book-1',
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('CancelBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on cancel', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new CancelBookingHandler(prisma as never, eventBus as never);

    await handler.execute({
      tenantId: 'tenant-1',
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED,
      changedBy: 'user-42',
    });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('CompleteBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on complete', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CompleteBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.COMPLETED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('NoShowBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on no-show', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new NoShowBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.NO_SHOW,
        changedBy: 'system',
      }),
    });
  });
});

describe('ExpireBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on expire', async () => {
    const prisma = buildPrisma();
    const handler = new ExpireBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.EXPIRED,
        changedBy: 'system',
      }),
    });
  });
});

describe('CheckInBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on check-in', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: null };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CheckInBookingHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
        reason: 'checked-in',
      }),
    });
  });
});

describe('ListBookingStatusLogHandler', () => {
  const mockLog = {
    id: 'log-1',
    tenantId: 'tenant-1',
    bookingId: 'book-1',
    fromStatus: BookingStatus.PENDING,
    toStatus: BookingStatus.CONFIRMED,
    changedBy: 'user-42',
    reason: null,
    createdAt: new Date(),
  };

  it('returns logs ordered by createdAt asc for a booking', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findMany: jest.fn().mockResolvedValue([mockLog]),
    };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', bookingId: 'book-1' });

    expect((prisma as any).bookingStatusLog.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', bookingId: 'book-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([mockLog]);
  });

  it('returns empty array when booking has no log entries', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', bookingId: 'no-logs' });

    expect(result).toEqual([]);
  });
});

const dbSettings = {
  id: 'settings-1', tenantId: 'tenant-1', branchId: null,
  bufferMinutes: 0, freeCancelBeforeHours: 24, freeCancelRefundType: 'FULL' as const,
  lateCancelRefundPercent: 0, maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2, autoNoShowAfterMinutes: 30,
  minBookingLeadMinutes: 60, maxAdvanceBookingDays: 90,
  waitlistEnabled: true, waitlistMaxPerSlot: 5,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('GetBookingSettingsHandler', () => {
  it('returns branch-level settings when they exist', async () => {
    const branchSettings = { ...dbSettings, id: 'settings-branch', branchId: 'branch-1', bufferMinutes: 10 };
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn().mockResolvedValueOnce(branchSettings),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect((result as typeof branchSettings).bufferMinutes).toBe(10);
    expect((prisma as any).bookingSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it('falls back to global settings when no branch-level row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(dbSettings),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect((result as typeof dbSettings).bufferMinutes).toBe(0);
    expect((prisma as any).bookingSettings.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns hardcoded defaults when no DB row exists', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      findUnique: jest.fn().mockResolvedValue(null),
    };
    const handler = new GetBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1' });

    expect(result.bufferMinutes).toBe(0);
    expect(result.freeCancelBeforeHours).toBe(24);
    expect(result.maxReschedulesPerBooking).toBe(3);
  });
});

describe('UpsertBookingSettingsHandler', () => {
  it('upserts settings for a given tenantId + branchId', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      upsert: jest.fn().mockResolvedValue({ ...dbSettings, bufferMinutes: 15 }),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never);

    const result = await handler.execute({ tenantId: 'tenant-1', branchId: 'branch-1', bufferMinutes: 15 });

    expect((prisma as any).bookingSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId_branchId: { tenantId: 'tenant-1', branchId: 'branch-1' } },
      update: { bufferMinutes: 15 },
      create: expect.objectContaining({ tenantId: 'tenant-1', branchId: 'branch-1', bufferMinutes: 15 }),
    });
    expect((result as typeof dbSettings).bufferMinutes).toBe(15);
  });

  it('upserts global settings when branchId is null', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingSettings = {
      upsert: jest.fn().mockResolvedValue(dbSettings),
    };
    const handler = new UpsertBookingSettingsHandler(prisma as never);

    await handler.execute({ tenantId: 'tenant-1', branchId: null, bufferMinutes: 5 });

    expect((prisma as any).bookingSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId_branchId: { tenantId: 'tenant-1', branchId: null } },
      update: { bufferMinutes: 5 },
      create: expect.objectContaining({ tenantId: 'tenant-1', branchId: null }),
    });
  });
});
