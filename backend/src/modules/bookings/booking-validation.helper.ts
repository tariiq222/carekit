import { BadRequestException, ConflictException } from '@nestjs/common';
import { toMinutes, timeSlotsOverlap, shiftTime } from '../../common/helpers/booking-time.helper.js';

/** Prisma client or transaction client — both expose the same query methods.
 *  Using 'any' for args because Prisma's generated types differ between
 *  PrismaClient and the transaction delegate, but the runtime API is identical. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = {
  practitionerVacation: { findFirst: (args: any) => Promise<any> };
  practitionerAvailability: { findMany: (args: any) => Promise<any[]> };
  booking: { findMany: (args: any) => Promise<any[]> };
};

/**
 * Validates that the requested time slot falls within the practitioner's
 * availability schedule and they are not on vacation.
 */
export async function validateAvailability(
  prisma: PrismaLike,
  practitionerId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<void> {
  // Normalize to UTC midnight to avoid timezone mismatches with stored vacation dates
  const normalizedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Check vacation
  const vacation = await prisma.practitionerVacation.findFirst({
    where: { practitionerId, startDate: { lte: normalizedDate }, endDate: { gte: normalizedDate } },
  });
  if (vacation) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Practitioner is on vacation on this date',
      error: 'PRACTITIONER_ON_VACATION',
    });
  }

  // Check availability schedule
  const dayOfWeek = date.getDay();
  const availabilities = await prisma.practitionerAvailability.findMany({
    where: { practitionerId, dayOfWeek, isActive: true },
  });

  if (availabilities.length === 0) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Practitioner is not available on this day',
      error: 'NOT_AVAILABLE',
    });
  }

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);

  const fitsSchedule = availabilities.some(
    (a) => toMinutes(a.startTime) <= startMin && toMinutes(a.endTime) >= endMin,
  );

  if (!fitsSchedule) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Requested time is outside practitioner availability hours',
      error: 'OUTSIDE_AVAILABILITY',
    });
  }
}

/**
 * Checks that no existing booking conflicts with the requested time slot,
 * accounting for buffer times before/after appointments.
 */
export async function checkDoubleBooking(
  prisma: PrismaLike,
  practitionerId: string, date: Date, startTime: string, endTime: string,
  excludeId?: string, bufferBefore: number = 0, bufferAfter: number = 0,
): Promise<void> {
  const whereClause: Record<string, unknown> = {
    practitionerId, date,
    status: { in: ['pending', 'confirmed'] },
    deletedAt: null,
  };
  if (excludeId) whereClause.id = { not: excludeId };

  const existingBookings = await prisma.booking.findMany({ where: whereClause });
  // Expand slot by buffer on both new and existing bookings (symmetric)
  const effectiveStart = shiftTime(startTime, -bufferBefore);
  const effectiveEnd = shiftTime(endTime, bufferAfter);
  const hasConflict = existingBookings.some((existing) => {
    const existingEffectiveStart = shiftTime(existing.startTime, -bufferBefore);
    const existingEffectiveEnd = shiftTime(existing.endTime, bufferAfter);
    return timeSlotsOverlap(effectiveStart, effectiveEnd, existingEffectiveStart, existingEffectiveEnd);
  });
  if (hasConflict) {
    throw new ConflictException({ statusCode: 409, message: 'Practitioner already has a booking at this time', error: 'BOOKING_CONFLICT' });
  }
}

// --- Clinic-level availability types ---

interface ClinicHoursData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ClinicHolidayData {
  date: Date;
  isRecurring: boolean;
}

/**
 * Validates that the booking date/time falls within clinic working hours
 * and does not land on a clinic holiday.
 */
export function validateClinicAvailability(
  clinicHours: ClinicHoursData[],
  holidays: ClinicHolidayData[],
  date: Date,
  startTime: string,
  endTime: string,
): void {
  // Check holiday
  const normalizedDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const isHoliday = holidays.some((h) => {
    const hDate = new Date(h.date);
    if (h.isRecurring) {
      return (
        hDate.getUTCMonth() === normalizedDate.getUTCMonth() &&
        hDate.getUTCDate() === normalizedDate.getUTCDate()
      );
    }
    const hNorm = new Date(
      Date.UTC(hDate.getFullYear(), hDate.getMonth(), hDate.getDate()),
    );
    return hNorm.getTime() === normalizedDate.getTime();
  });

  if (isHoliday) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Clinic is closed on this holiday',
      error: 'CLINIC_HOLIDAY',
    });
  }

  // Check clinic hours
  const dayOfWeek = date.getDay();
  const dayHours = clinicHours.filter(
    (h) => h.dayOfWeek === dayOfWeek && h.isActive,
  );

  if (dayHours.length === 0) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Clinic is closed on this day',
      error: 'CLINIC_CLOSED',
    });
  }

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);

  const fitsClinic = dayHours.some(
    (h) => toMinutes(h.startTime) <= startMin && toMinutes(h.endTime) >= endMin,
  );

  if (!fitsClinic) {
    throw new BadRequestException({
      statusCode: 400,
      message: 'Requested time is outside clinic working hours',
      error: 'OUTSIDE_CLINIC_HOURS',
    });
  }
}
