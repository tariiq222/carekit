import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { toMinutes } from '../../common/helpers/booking-time.helper.js';

/**
 * Validates that the requested time slot falls within the practitioner's
 * availability schedule and they are not on vacation.
 */
export async function validateAvailability(
  prisma: PrismaService,
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
