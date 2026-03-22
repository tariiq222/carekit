import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';

const TIME_REGEX = /^\d{2}:\d{2}$/;

@Injectable()
export class PractitionerAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(practitionerId: string) {
    await this.ensurePractitionerExists(practitionerId);

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
    const practitioner = await this.ensurePractitionerExists(practitionerId);

    if (currentUserId) {
      await this.checkOwnership(practitioner.userId, currentUserId);
    }

    this.validateScheduleSlots(dto.schedule);
    this.checkOverlappingSlots(dto.schedule);

    // Replace all availability records
    await this.prisma.practitionerAvailability.deleteMany({
      where: { practitionerId },
    });

    await this.prisma.practitionerAvailability.createMany({
      data: dto.schedule.map((slot) => ({
        practitionerId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isActive: slot.isActive ?? true,
      })),
    });

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

    await this.ensurePractitionerExists(practitionerId);

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation on this date
    const vacation = await this.prisma.practitionerVacation.findFirst({
      where: {
        practitionerId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
    });

    if (vacation) {
      return { date, practitionerId, slots: [] };
    }

    const slots = this.generateSlots(availabilities, duration);
    return { date, practitionerId, slots };
  }

  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30) {
    await this.ensurePractitionerExists(practitionerId);

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    const availabilities = await this.prisma.practitionerAvailability.findMany({
      where: { practitionerId, dayOfWeek, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    // Check for vacation
    const vacations = await this.prisma.practitionerVacation.findMany({
      where: { practitionerId },
    });
    const isOnVacation = vacations.some((v: { startDate: Date; endDate: Date }) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      return targetDate >= start && targetDate <= end;
    });

    if (isOnVacation) {
      return [];
    }

    // Get existing bookings for this date
    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        status: { in: ['confirmed', 'pending'] },
      },
    });

    const allSlots = this.generateSlots(availabilities, duration);

    return allSlots.filter((slot) => {
      const isBooked = bookings.some((b: { startTime: string; endTime: string }) =>
        b.startTime === slot.startTime && b.endTime === slot.endTime,
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

  private async ensurePractitionerExists(practitionerId: string) {
    const practitioner = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId },
    });
    if (!practitioner || practitioner.deletedAt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Practitioner not found',
        error: 'PRACTITIONER_NOT_FOUND',
      });
    }
    return practitioner;
  }

  private async checkOwnership(ownerUserId: string, currentUserId: string) {
    if (ownerUserId === currentUserId) return;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: { userRoles: { include: { role: true } } },
    });

    const roles = dbUser?.userRoles.map((ur: { role: { slug: string } }) => ur.role.slug) ?? [];
    const isAdmin = roles.includes('super_admin') || roles.includes('receptionist');

    if (!isAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only edit your own profile',
        error: 'FORBIDDEN',
      });
    }
  }
}
