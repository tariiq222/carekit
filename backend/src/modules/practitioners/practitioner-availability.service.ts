import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingSettingsService } from '../bookings/booking-settings.service.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { timeSlotsOverlap } from '../../common/helpers/booking-time.helper.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { ensurePractitionerExists } from '../../common/helpers/practitioner.helper.js';
import { CLINIC_TIMEZONE } from '../../config/constants/index.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

@Injectable()
export class PractitionerAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  async getAvailability(practitionerId: string) {
    await ensurePractitionerExists(this.prisma, practitionerId);

    return this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, isActive: true },
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

    this.validateScheduleSlots(dto.schedule);
    this.checkOverlappingSlots(dto.schedule);

    // Replace all availability records atomically
    await this.prisma.$transaction([
      this.prisma.practitionerAvailability.deleteMany({
        where: { practitionerId },
      }),
      this.prisma.practitionerAvailability.createMany({
        data: dto.schedule.map((slot) => ({
          practitionerId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isActive: slot.isActive ?? true,
        })),
      }),
    ]);

    return this.prisma.practitionerAvailability.findMany({
      where: { practitionerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getSlots(practitionerId: string, date: string, duration: number = 30) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'date query parameter is required',
        error: 'VALIDATION_ERROR',
      });
    }

    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);

    if (!practitioner.isAcceptingBookings) {
      return { date, practitionerId, slots: [] };
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    // Normalize to UTC midnight for consistent vacation comparison
    const normalizedDate = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

    // M8: Parallelize independent queries — availabilities and vacation check are independent
    const [availabilities, vacation] = await Promise.all([
      this.prisma.practitionerAvailability.findMany({
        where: { practitionerId, dayOfWeek, isActive: true },
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

    if (vacation) {
      return { date, practitionerId, slots: [] };
    }

    // settings and breaks are independent of each other — run in parallel
    const [settings, breaks] = await Promise.all([
      this.bookingSettingsService.get(),
      this.prisma.practitionerBreak.findMany({ where: { practitionerId, dayOfWeek } }),
    ]);
    const bufferMinutes = settings.bufferMinutes ?? 0;
    const isToday = this.isSameLocalDate(targetDate, new Date());

    const allSlots = this.generateSlots(availabilities, duration, bufferMinutes, isToday);

    const slotsWithoutBreaks = allSlots.filter((slot) =>
      !breaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );

    // Subtract booked slots so the public API shows real availability
    const targetDateStart = new Date(normalizedDate);
    const targetDateEnd = new Date(normalizedDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        date: { gte: targetDateStart, lte: targetDateEnd },
        status: { in: ['confirmed', 'pending', 'checked_in', 'in_progress'] },
        deletedAt: null,
      },
      select: { startTime: true, endTime: true },
    });

    const slots = slotsWithoutBreaks.map((slot) => {
      const isBooked = bookings.some((b) =>
        timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
      );
      return { ...slot, available: !isBooked };
    });

    return { date, practitionerId, slots };
  }

  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);

    if (!practitioner.isAcceptingBookings) {
      return [];
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const normalizedDate = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation on this specific date
    const vacation = await this.prisma.practitionerVacation.findFirst({
      where: {
        practitionerId,
        startDate: { lte: normalizedDate },
        endDate: { gte: normalizedDate },
      },
    });

    if (vacation) {
      return [];
    }

    // Get existing bookings for this specific date
    const targetDateStart = new Date(normalizedDate);
    const targetDateEnd = new Date(normalizedDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        date: { gte: targetDateStart, lte: targetDateEnd },
        status: { in: ['confirmed', 'pending', 'checked_in', 'in_progress'] },
        deletedAt: null,
      },
      select: { startTime: true, endTime: true },
    });

    const settings = await this.bookingSettingsService.get();
    const bufferMinutes = settings.bufferMinutes ?? 0;
    const isToday = this.isSameLocalDate(targetDate, new Date());

    const allSlots = this.generateSlots(availabilities, duration, bufferMinutes, isToday);

    // Subtract breaks for this day
    const breaks = await this.prisma.practitionerBreak.findMany({
      where: { practitionerId, dayOfWeek },
    });

    const slotsWithoutBreaks = allSlots.filter((slot) =>
      !breaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );

    return slotsWithoutBreaks.filter((slot) => {
      const isBooked = bookings.some((b) =>
        timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
      );
      return !isBooked;
    });
  }

  // --- Private helpers ---

  private generateSlots(
    availabilities: Array<{ startTime: string; endTime: string }>,
    duration: number,
    bufferMinutes: number = 0,
    isToday: boolean = false,
  ) {
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
    const step = duration + bufferMinutes;

    // Current time in Asia/Riyadh for today filtering
    const nowMinutes = isToday ? this.getNowMinutesRiyadh() : -1;

    for (const avail of availabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += step) {
        const slotEndMinutes = m + duration;
        // Skip past slots when viewing today
        if (isToday && slotEndMinutes <= nowMinutes) continue;

        const slotStart = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;
        slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
      }
    }

    return slots;
  }

  /** Returns current time as minutes-since-midnight in Asia/Riyadh timezone */
  private getNowMinutesRiyadh(): number {
    const now = new Date();
    const riyadhTime = new Intl.DateTimeFormat('en-US', {
      timeZone: CLINIC_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    const [h, m] = riyadhTime.split(':').map(Number);
    return h * 60 + m;
  }

  /** Compares two dates by local calendar day in Asia/Riyadh timezone */
  private isSameLocalDate(a: Date, b: Date): boolean {
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIMEZONE }).format(d);
    return fmt(a) === fmt(b);
  }

  private validateScheduleSlots(schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
    for (const slot of schedule) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'dayOfWeek must be between 0 and 6',
          error: 'VALIDATION_ERROR',
        });
      }

      if (!TIME_REGEX.test(slot.startTime) || !TIME_REGEX.test(slot.endTime)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Time must be in HH:mm format',
          error: 'VALIDATION_ERROR',
        });
      }

      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'startTime must be before endTime',
          error: 'VALIDATION_ERROR',
        });
      }
    }
  }

  private checkOverlappingSlots(schedule: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
    const byDay = new Map<number, Array<{ startTime: string; endTime: string }>>();
    for (const slot of schedule) {
      const daySlots = byDay.get(slot.dayOfWeek) ?? [];
      for (const existing of daySlots) {
        if (slot.startTime < existing.endTime && slot.endTime > existing.startTime) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Overlapping time slots on the same day',
            error: 'VALIDATION_ERROR',
          });
        }
      }
      daySlots.push({ startTime: slot.startTime, endTime: slot.endTime });
      byDay.set(slot.dayOfWeek, daySlots);
    }
  }
}
