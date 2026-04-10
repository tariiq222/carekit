import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { timeSlotsOverlap } from '../../common/helpers/booking-time.helper.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { ensurePractitionerExists } from '../../common/helpers/practitioner.helper.js';
import {
  generateSlots,
  isSameLocalDate,
  validateScheduleSlots,
  checkOverlappingSlots,
} from './availability-helpers.js';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';
import { ClinicHolidaysService } from '../clinic/clinic-holidays.service.js';

@Injectable()
export class PractitionerAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSettingsService: BookingSettingsService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly clinicHolidaysService: ClinicHolidaysService,
  ) {}

  async getAvailability(practitionerId: string, branchId?: string) {
    await ensurePractitionerExists(this.prisma, practitionerId);

    return this.prisma.practitionerAvailability.findMany({
      where: {
        practitionerId,
        isActive: true,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setAvailability(
    practitionerId: string,
    dto: SetAvailabilityDto,
    currentUserId?: string,
  ) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);

    if (currentUserId) {
      await checkOwnership(this.prisma, practitioner.userId, currentUserId);
    }

    validateScheduleSlots(dto.schedule);
    checkOverlappingSlots(dto.schedule);

    // Replace all availability records atomically
    await this.prisma.$transaction([
      this.prisma.practitionerAvailability.deleteMany({ where: { practitionerId } }),
      this.prisma.practitionerAvailability.createMany({
        data: dto.schedule.map((slot) => ({
          practitionerId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive ?? true,
          branchId: slot.branchId ?? null,
        })),
      }),
    ]);

    return this.prisma.practitionerAvailability.findMany({
      where: { practitionerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getSlots(practitionerId: string, date: string, duration: number = 30, branchId?: string) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'date query parameter is required',
        error: 'VALIDATION_ERROR',
      });
    }
    return this.resolveSlots(practitionerId, date, duration, branchId);
  }

  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30, branchId?: string) {
    const { slots } = await this.resolveSlots(practitionerId, date, duration, branchId);
    return slots.filter((s) => s.available);
  }

  /**
   * Returns a Set of date strings (YYYY-MM-DD) that have at least one available slot
   * for the given practitioner within the specified month.
   * Uses bulk DB queries to avoid N+1 per day.
   */
  async getAvailableDates(
    practitionerId: string,
    month: string,
    duration: number = 30,
    branchId?: string,
  ): Promise<{ availableDates: string[] }> {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (!practitioner.isAcceptingBookings) {
      return { availableDates: [] };
    }

    // Parse month → first and last day
    const [year, mon] = month.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, mon - 1, 1));
    const lastDay = new Date(Date.UTC(year, mon, 0)); // last day of month

    // Today (start of day UTC) — skip past days
    const todayUTC = new Date(Date.UTC(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    ));

    // Bulk fetch: all availability records for this practitioner
    const [allAvailabilities, vacations, breaks, bookings, settings] = await Promise.all([
      this.prisma.practitionerAvailability.findMany({
        where: {
          practitionerId,
          isActive: true,
          ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
        },
      }),
      this.prisma.practitionerVacation.findMany({
        where: {
          practitionerId,
          startDate: { lte: lastDay },
          endDate: { gte: firstDay },
        },
      }),
      this.prisma.practitionerBreak.findMany({ where: { practitionerId } }),
      this.prisma.booking.findMany({
        where: {
          practitionerId,
          date: { gte: firstDay, lte: new Date(lastDay.getTime() + 86399999) },
          status: { in: ['confirmed', 'pending', 'checked_in', 'in_progress'] },
          deletedAt: null,
        },
        select: { startTime: true, endTime: true, date: true },
      }),
      this.bookingSettingsService.getForBranch(branchId),
    ]);

    const bufferMinutes = await this.resolveBufferMinutes(practitionerId, settings.bufferMinutes ?? 0);
    const availableDates: string[] = [];

    // Group bookings by date string for fast lookup
    const bookingsByDate = new Map<string, Array<{ startTime: string; endTime: string }>>();
    for (const b of bookings) {
      const key = b.date.toISOString().slice(0, 10);
      const arr = bookingsByDate.get(key) ?? [];
      arr.push({ startTime: b.startTime, endTime: b.endTime });
      bookingsByDate.set(key, arr);
    }

    // Bulk-load holidays for the month once — avoids N async calls inside the loop
    const [clinicTz, monthHolidays] = await Promise.all([
      this.clinicSettingsService.getTimezone(),
      this.clinicHolidaysService.findAll(year),
    ]);

    // Iterate each day of the month
    const cursor = new Date(firstDay);
    while (cursor <= lastDay) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const dayOfWeek = cursor.getDay();

      // Skip past days
      if (cursor < todayUTC) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Skip vacation days
      const onVacation = vacations.some(
        (v) => cursor >= v.startDate && cursor <= v.endDate,
      );
      if (onVacation) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Skip clinic holidays (inline check against pre-loaded set)
      const normalizedCursor = new Date(
        Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
      );
      const isHoliday = monthHolidays.some((h) => {
        const hDate = new Date(h.date);
        if (h.isRecurring) {
          return (
            hDate.getUTCMonth() === normalizedCursor.getUTCMonth() &&
            hDate.getUTCDate() === normalizedCursor.getUTCDate()
          );
        }
        const hNorm = new Date(
          Date.UTC(hDate.getFullYear(), hDate.getMonth(), hDate.getDate()),
        );
        return hNorm.getTime() === normalizedCursor.getTime();
      });
      if (isHoliday) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Get availability for this day-of-week
      const dayAvailabilities = allAvailabilities.filter((a) => a.dayOfWeek === dayOfWeek);
      if (dayAvailabilities.length === 0) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Get breaks for this day-of-week
      const dayBreaks = breaks.filter((b) => b.dayOfWeek === dayOfWeek);

      // Generate slots
      const isToday = isSameLocalDate(cursor, new Date(), clinicTz);
      const allSlots = generateSlots(dayAvailabilities, duration, bufferMinutes, isToday);

      // Filter out break-overlapping slots
      const slotsAfterBreaks = allSlots.filter(
        (slot) => !dayBreaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
      );

      if (slotsAfterBreaks.length === 0) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        continue;
      }

      // Check if at least one slot is not booked
      const dayBookings = bookingsByDate.get(dateStr) ?? [];
      const hasAvailable = slotsAfterBreaks.some(
        (slot) => !dayBookings.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
      );

      if (hasAvailable) {
        availableDates.push(dateStr);
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { availableDates };
  }

  private async resolveSlots(
    practitionerId: string,
    date: string,
    duration: number,
    branchId?: string,
  ): Promise<{
    slots: Array<{ startTime: string; endTime: string; available: boolean }>;
    date: string;
    practitionerId: string;
  }> {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (!practitioner.isAcceptingBookings) {
      return { date, practitionerId, slots: [] };
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const normalizedDate = new Date(Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    ));

    const [availabilities, vacation] = await Promise.all([
      this.prisma.practitionerAvailability.findMany({
        where: {
          practitionerId,
          dayOfWeek,
          isActive: true,
          ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.practitionerVacation.findFirst({
        where: {
          practitionerId,
          startDate: { lte: normalizedDate },
          endDate: { gte: normalizedDate },
        },
      }),
    ]);

    if (vacation) return { date, practitionerId, slots: [] };

    const isHoliday = await this.clinicHolidaysService.isHoliday(normalizedDate);
    if (isHoliday) return { date, practitionerId, slots: [] };

    const targetDateEnd = new Date(normalizedDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const [settings, breaks, bookings] = await Promise.all([
      this.bookingSettingsService.getForBranch(branchId),
      this.prisma.practitionerBreak.findMany({ where: { practitionerId, dayOfWeek } }),
      this.prisma.booking.findMany({
        where: {
          practitionerId,
          date: { gte: normalizedDate, lte: targetDateEnd },
          status: { in: ['confirmed', 'pending', 'checked_in', 'in_progress'] },
          deletedAt: null,
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const bufferMinutes = await this.resolveBufferMinutes(practitionerId, settings.bufferMinutes ?? 0);

    const clinicTz = await this.clinicSettingsService.getTimezone();
    const isToday = isSameLocalDate(targetDate, new Date(), clinicTz);
    const allSlots = generateSlots(availabilities, duration, bufferMinutes, isToday);

    const slotsWithoutBreaks = allSlots.filter(
      (slot) => !breaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );

    const slots = slotsWithoutBreaks.map((slot) => ({
      ...slot,
      available: !bookings.some((b) =>
        timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
      ),
    }));

    return { date, practitionerId, slots };
  }

  /**
   * Resolves the effective buffer minutes for slot generation.
   *
   * Bug fixed (CRITICAL #2): PractitionerService.bufferMinutes has @default(0) in Prisma,
   * so `ps.bufferMinutes ?? service.bufferMinutes` always short-circuits to 0 — the ??
   * operator only fires on null/undefined, not on the value 0.
   *
   * Correct logic: use ps.bufferMinutes as an explicit override only when > 0.
   * Otherwise fall through to service.bufferMinutes, then global settings.
   *
   * Without serviceId (calendar view): take the maximum across all services this
   * practitioner offers — conservative choice to avoid buffer collisions.
   */
  private async resolveBufferMinutes(
    practitionerId: string,
    globalBufferMinutes: number,
    serviceId?: string,
  ): Promise<number> {
    if (serviceId) {
      // Specific service context — resolve precisely
      const ps = await this.prisma.practitionerService.findUnique({
        where: { practitionerId_serviceId: { practitionerId, serviceId } },
        select: {
          bufferMinutes: true,
          service: { select: { bufferMinutes: true } },
        },
      });

      if (!ps) return globalBufferMinutes;

      // ps.bufferMinutes > 0 means explicit practitioner override; otherwise use service default
      const effectiveBuffer = ps.bufferMinutes > 0
        ? ps.bufferMinutes
        : ps.service.bufferMinutes;

      return Math.max(globalBufferMinutes, effectiveBuffer);
    }

    // No specific service — take max across all services offered by this practitioner
    // to ensure no booking can be squeezed into a buffer window of any service
    const psRecords = await this.prisma.practitionerService.findMany({
      where: { practitionerId, isActive: true },
      select: {
        bufferMinutes: true,
        service: { select: { bufferMinutes: true } },
      },
    });

    const maxServiceBuffer = psRecords.reduce((max, ps) => {
      // Use ps override when explicitly set (> 0), otherwise fall back to service default
      const effective = ps.bufferMinutes > 0 ? ps.bufferMinutes : ps.service.bufferMinutes;
      return Math.max(max, effective);
    }, 0);

    return Math.max(globalBufferMinutes, maxServiceBuffer);
  }
}
