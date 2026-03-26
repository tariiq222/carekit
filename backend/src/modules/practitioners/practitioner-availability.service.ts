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

@Injectable()
export class PractitionerAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSettingsService: BookingSettingsService,
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

    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (!practitioner.isAcceptingBookings) return { date, practitionerId, slots: [] };

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const normalizedDate = new Date(Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    ));

    // M8: Parallelize independent queries
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

    // Settings and breaks are independent — run in parallel
    const [settings, breaks] = await Promise.all([
      this.bookingSettingsService.getForBranch(branchId),
      this.prisma.practitionerBreak.findMany({ where: { practitionerId, dayOfWeek } }),
    ]);

    const bufferMinutes = settings.bufferMinutes ?? 0;
    const isToday = isSameLocalDate(targetDate, new Date());
    const allSlots = generateSlots(availabilities, duration, bufferMinutes, isToday);

    const slotsWithoutBreaks = allSlots.filter(
      (slot) => !breaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );

    const targetDateEnd = new Date(normalizedDate);
    targetDateEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await this.prisma.booking.findMany({
      where: {
        practitionerId,
        date: { gte: normalizedDate, lte: targetDateEnd },
        status: { in: ['confirmed', 'pending', 'checked_in', 'in_progress'] },
        deletedAt: null,
      },
      select: { startTime: true, endTime: true },
    });

    const slots = slotsWithoutBreaks.map((slot) => ({
      ...slot,
      available: !bookings.some((b) =>
        timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime),
      ),
    }));

    return { date, practitionerId, slots };
  }

  async getAvailableSlots(practitionerId: string, date: string, duration: number = 30, branchId?: string) {
    const practitioner = await ensurePractitionerExists(this.prisma, practitionerId);
    if (!practitioner.isAcceptingBookings) return [];

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

    if (vacation) return [];

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

    const isToday = isSameLocalDate(targetDate, new Date());
    const allSlots = generateSlots(availabilities, duration, settings.bufferMinutes ?? 0, isToday);

    const slotsWithoutBreaks = allSlots.filter(
      (slot) => !breaks.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );

    return slotsWithoutBreaks.filter(
      (slot) => !bookings.some((b) => timeSlotsOverlap(slot.startTime, slot.endTime, b.startTime, b.endTime)),
    );
  }
}
