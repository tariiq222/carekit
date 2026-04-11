import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { CreateBookingHandler } from './create-booking/create-booking.handler';
import { CancelBookingHandler } from './cancel-booking/cancel-booking.handler';
import { RescheduleBookingHandler } from './reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from './confirm-booking/confirm-booking.handler';
import { AddToWaitlistHandler } from './add-to-waitlist/add-to-waitlist.handler';
import { GetBookingHandler } from './get-booking/get-booking.handler';
import { ListBookingsHandler } from './list-bookings/list-bookings.handler';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';

const future = new Date(Date.now() + 86400_000);
const past = new Date(Date.now() - 86400_000);

const mockBooking = {
  id: 'book-1', tenantId: 'tenant-1', branchId: 'branch-1',
  clientId: 'client-1', employeeId: 'emp-1', serviceId: 'svc-1',
  scheduledAt: future, durationMins: 60, price: 200, currency: 'SAR',
  status: BookingStatus.PENDING, bookingType: 'INDIVIDUAL',
};

const buildPrisma = () => ({
  booking: {
    findUnique: jest.fn().mockResolvedValue(mockBooking),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockBooking),
    update: jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED }),
    findMany: jest.fn().mockResolvedValue([mockBooking]),
    count: jest.fn().mockResolvedValue(1),
  },
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
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

// ─── CreateBookingHandler ────────────────────────────────────────────────────
describe('CreateBookingHandler', () => {
  it('creates booking when slot is free', async () => {
    const prisma = buildPrisma();
    const result = await new CreateBookingHandler(prisma as never).execute({
      tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
      employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future, durationMins: 60, price: 200,
    });
    expect(result.id).toBe('book-1');
  });

  it('throws ConflictException on overlapping slot', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
    await expect(
      new CreateBookingHandler(prisma as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: future, durationMins: 60, price: 200,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException for past scheduledAt', async () => {
    await expect(
      new CreateBookingHandler(buildPrisma() as never).execute({
        tenantId: 'tenant-1', branchId: 'branch-1', clientId: 'client-1',
        employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: past, durationMins: 60, price: 200,
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
      tenantId: 'tenant-1', bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED,
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
        tenantId: 'tenant-1', bookingId: 'bad', reason: CancellationReason.OTHER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when booking is already CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        tenantId: 'tenant-1', bookingId: 'book-1', reason: CancellationReason.OTHER,
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
      tenantId: 'tenant-1', bookingId: 'book-1',
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
        tenantId: 'tenant-1', bookingId: 'book-1',
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
    const result = await new ListBookingsHandler(prisma as never).execute({
      tenantId: 'tenant-1', page: 1, limit: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });
});

// ─── CheckAvailabilityHandler ────────────────────────────────────────────────
describe('CheckAvailabilityHandler', () => {
  it('returns available slots for open business day', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([]);
    const tomorrowDate = new Date(future);
    tomorrowDate.setHours(0, 0, 0, 0);
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: tomorrowDate, durationMins: 60,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array when branch is closed', async () => {
    const prisma = buildPrisma();
    prisma.businessHour.findUnique = jest.fn().mockResolvedValue({ isOpen: false });
    const result = await new CheckAvailabilityHandler(prisma as never).execute({
      tenantId: 'tenant-1', employeeId: 'emp-1', branchId: 'branch-1',
      date: future, durationMins: 60,
    });
    expect(result).toEqual([]);
  });
});
