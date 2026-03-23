import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { timeSlotsOverlap } from '../../common/helpers/booking-time.helper.js';
import { checkOwnership } from '../../common/helpers/ownership.helper.js';
import { ensurePractitionerExists } from '../../common/helpers/practitioner.helper.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

@Injectable()
export class PractitionerAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

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

    await ensurePractitionerExists(this.prisma, practitionerId);

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    // Normalize to UTC midnight for consistent vacation comparison
    const normalizedDate = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));

    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation on this date
    const vacation = await this.prisma.practitionerVacation.findFirst({
      where: {
        practitionerId,
        startDate: { lte: normalizedDate },
        endDate: { gte: normalizedDate },
      },
    });

    if (vacation) {
      return { date, practitionerId, slots: [] };
    }

    const allSlots = this.generateSlots(availabilities, duration);

    // Subtract booked slots so the public API shows real availability
    const targetDateStart = new Date(normalizedDate);
    const targetDateEnd = new Date(normalizedDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        date: { gte: targetDateStart, lte: targetDateEnd },
        status: { in: ['confirmed', 'pending'] },
        deletedAt: null,
      },
      select: { startTime: true, endTime: true },
    });

    const slots = allSlots.map((slot) => {
      const isBooked = bookings.some((b) =>
        timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
      );
      return { ...slot, available: !isBooked };
    });

    return { date, practitionerId, slots };
  }

  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30) {
    await ensurePractitionerExists(this.prisma, practitionerId);

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
        status: { in: ['confirmed', 'pending'] },
        deletedAt: null,
      },
      select: { startTime: true, endTime: true },
    });

    const allSlots = this.generateSlots(availabilities, duration);

    return allSlots.filter((slot) => {
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
  ) {
    const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

    for (const avail of availabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
        const slotStart = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((m + duration) / 60)).padStart(2, '0')}:${String((m + duration) % 60).padStart(2, '0')}`;
        slots.push({ startTime: slotStart, endTime: slotEnd, available: true });
      }
    }

    return slots;
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
