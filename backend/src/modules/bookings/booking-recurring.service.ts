import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingsService } from './bookings.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto.js';

/* ─── Pattern → interval in days ─── */

const PATTERN_DAYS: Record<string, number> = {
  daily: 1,
  every_2_days: 2,
  every_3_days: 3,
  weekly: 7,
  biweekly: 14,
  monthly: 0, // handled separately (calendar month)
};

function addInterval(date: Date, pattern: string): Date {
  const next = new Date(date);
  if (pattern === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + (PATTERN_DAYS[pattern] ?? 7));
  }
  return next;
}

@Injectable()
export class BookingRecurringService {
  private readonly logger = new Logger(BookingRecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  async createRecurring(callerUserId: string, dto: CreateRecurringBookingDto, callerRoles?: Array<{ slug: string }>) {
    // Validate service exists and supports recurring bookings (CRITICAL fix #4)
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, isActive: true, deletedAt: null },
      select: { allowRecurring: true, allowedRecurringPatterns: true, maxRecurrences: true },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found or inactive',
        error: 'NOT_FOUND',
      });
    }
    if (!service.allowRecurring) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'This service does not support recurring bookings',
        error: 'SERVICE_RECURRING_NOT_ALLOWED',
      });
    }

    const settings = await this.bookingSettingsService.getForBranch(dto.branchId);

    // Allow admin/staff to book for a specific patient; otherwise use the caller's own ID
    const patientId = dto.patientId ?? callerUserId;

    if (!settings.allowRecurring) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Recurring bookings are not enabled',
        error: 'RECURRING_NOT_ALLOWED',
      });
    }

    /* Validate pattern is allowed:
     * Service-level patterns (if set) take precedence over clinic-level — more restrictive.
     * E.g. clinic allows [daily, weekly] but service only allows [weekly] → weekly only.
     */
    const servicePatterns: string[] = service.allowedRecurringPatterns?.length
      ? service.allowedRecurringPatterns
      : [];
    const clinicPatterns: string[] = settings.allowedRecurringPatterns?.length
      ? settings.allowedRecurringPatterns
      : ['weekly', 'biweekly'];
    // Intersection: pattern must be allowed by both service AND clinic
    const allowedPatterns = servicePatterns.length > 0
      ? servicePatterns.filter((p) => clinicPatterns.includes(p))
      : clinicPatterns;
    if (!allowedPatterns.includes(dto.repeatEvery)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Pattern "${dto.repeatEvery}" is not allowed for this service. Allowed: ${allowedPatterns.join(', ')}`,
        error: 'RECURRING_PATTERN_NOT_ALLOWED',
      });
    }

    /* Validate count limit — use the stricter of service and clinic limits */
    const serviceMax = service.maxRecurrences > 0 ? service.maxRecurrences : Infinity;
    const clinicMax = settings.maxRecurrences ?? 12;
    const maxCount = Math.min(serviceMax, clinicMax);
    if (dto.repeatCount > maxCount) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Repeat count ${dto.repeatCount} exceeds maximum of ${maxCount}`,
        error: 'RECURRING_TOO_MANY',
      });
    }

    const recurringGroupId = randomUUID();
    const created: Array<{ id: string; date: string }> = [];
    const conflicts: Array<{ date: string; reason: string }> = [];

    let currentDate = new Date(dto.date);

    for (let i = 0; i < dto.repeatCount; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];

      try {
        // Pass recurringGroupId directly into create — atomic, no separate update needed
        // callerUserId is the admin/staff user; patientId in dto is the actual patient
        const booking = await this.bookingsService.create(callerUserId, {
          practitionerId: dto.practitionerId,
          serviceId: dto.serviceId,
          branchId: dto.branchId,
          type: dto.type,
          date: dateStr,
          startTime: dto.startTime,
          notes: dto.notes,
          recurringGroupId,
          patientId,
        }, callerRoles);

        created.push({ id: booking.id, date: dateStr });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Recurring booking conflict on ${dateStr}: ${message}`);
        conflicts.push({ date: dateStr, reason: message });
      }

      currentDate = addInterval(currentDate, dto.repeatEvery);
    }

    return {
      recurringGroupId,
      pattern: dto.repeatEvery,
      created,
      conflicts,
      totalRequested: dto.repeatCount,
      totalCreated: created.length,
    };
  }
}
