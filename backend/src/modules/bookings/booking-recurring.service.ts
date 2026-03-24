import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingsService } from './bookings.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { CreateRecurringBookingDto } from './dto/create-recurring-booking.dto.js';

@Injectable()
export class BookingRecurringService {
  private readonly logger = new Logger(BookingRecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  async createRecurring(patientId: string, dto: CreateRecurringBookingDto) {
    const settings = await this.bookingSettingsService.get();
    if (!settings.allowRecurring) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Recurring bookings are not enabled',
        error: 'RECURRING_NOT_ALLOWED',
      });
    }

    const weeksNeeded = dto.repeatEvery === 'weekly'
      ? dto.repeatCount
      : dto.repeatCount * 2;

    if (weeksNeeded > settings.maxRecurringWeeks) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Recurring period exceeds maximum of ${settings.maxRecurringWeeks} weeks`,
        error: 'RECURRING_TOO_LONG',
      });
    }

    const recurringGroupId = randomUUID();
    const created: Array<{ id: string; date: string }> = [];
    const conflicts: Array<{ date: string; reason: string }> = [];
    const intervalDays = dto.repeatEvery === 'weekly' ? 7 : 14;

    for (let i = 0; i < dto.repeatCount; i++) {
      const bookingDate = new Date(dto.date);
      bookingDate.setDate(bookingDate.getDate() + (i * intervalDays));
      const dateStr = bookingDate.toISOString().split('T')[0];

      try {
        const booking = await this.bookingsService.create(patientId, {
          practitionerId: dto.practitionerId,
          serviceId: dto.serviceId,
          type: dto.type,
          date: dateStr,
          startTime: dto.startTime,
          notes: dto.notes,
        });

        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { recurringGroupId },
        });

        created.push({ id: booking.id, date: dateStr });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Recurring booking conflict on ${dateStr}: ${message}`);
        conflicts.push({ date: dateStr, reason: message });
      }
    }

    return {
      recurringGroupId,
      created,
      conflicts,
      totalRequested: dto.repeatCount,
      totalCreated: created.length,
    };
  }
}
