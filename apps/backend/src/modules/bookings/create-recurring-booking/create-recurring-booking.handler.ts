import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RecurringFrequency } from '@prisma/client';
import type { Booking } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { randomUUID } from 'crypto';
import type { CreateRecurringBookingDto } from './create-recurring-booking.dto';

@Injectable()
export class CreateRecurringBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateRecurringBookingDto) {
    this.validate(dto);

    const dates = this.resolveDates(dto);
    const recurringGroupId = randomUUID();

    // skipConflicts=true: best-effort — no transaction needed, partial series is intentional.
    // skipConflicts=false (default): all-or-nothing — wrap in transaction so a mid-series
    // conflict rolls back already-created bookings.
    if (dto.skipConflicts) {
      return this.createBookings(this.prisma, dto, dates, recurringGroupId);
    }
    return this.prisma.$transaction((tx) =>
      this.createBookings(tx as unknown as PrismaService, dto, dates, recurringGroupId),
    );
  }

  private async createBookings(
    db: PrismaService,
    dto: CreateRecurringBookingDto,
    dates: Date[],
    recurringGroupId: string,
  ): Promise<Booking[]> {
    const created: Booking[] = [];

    for (const scheduledAt of dates) {
      const endsAt = new Date(scheduledAt.getTime() + dto.durationMins * 60_000);

      const conflict = await db.booking.findFirst({
        where: {
          tenantId: dto.tenantId,
          employeeId: dto.employeeId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { lt: endsAt },
          endsAt: { gt: scheduledAt },
        },
      });

      if (conflict) {
        if (dto.skipConflicts) continue;
        throw new ConflictException(
          `Employee already has a booking at ${scheduledAt.toISOString()}`,
        );
      }

      const booking = await db.booking.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          clientId: dto.clientId,
          employeeId: dto.employeeId,
          serviceId: dto.serviceId,
          scheduledAt,
          endsAt,
          durationMins: dto.durationMins,
          price: dto.price,
          currency: dto.currency ?? 'SAR',
          bookingType: dto.bookingType ?? 'INDIVIDUAL',
          notes: dto.notes,
          expiresAt: dto.expiresAt,
          recurringGroupId,
          recurringPattern: dto.frequency,
          status: 'PENDING',
        },
      });

      created.push(booking);
    }

    return created;
  }

  private validate(dto: CreateRecurringBookingDto): void {
    if (dto.frequency === RecurringFrequency.CUSTOM) {
      if (!dto.customDates?.length) {
        throw new BadRequestException(
          'customDates is required for CUSTOM frequency',
        );
      }
      return;
    }

    const hasOccurrences = dto.occurrences !== undefined;
    const hasUntil = dto.until !== undefined;

    if (!hasOccurrences && !hasUntil) {
      throw new BadRequestException(
        'Either occurrences or until must be provided',
      );
    }
    if (hasOccurrences && hasUntil) {
      throw new BadRequestException(
        'occurrences and until are mutually exclusive',
      );
    }
    if (hasOccurrences && dto.occurrences! < 1) {
      throw new BadRequestException('occurrences must be at least 1');
    }
    if (dto.intervalDays !== undefined && dto.intervalDays < 1) {
      throw new BadRequestException('intervalDays must be at least 1');
    }
  }

  private resolveDates(dto: CreateRecurringBookingDto): Date[] {
    if (dto.frequency === RecurringFrequency.CUSTOM) {
      return dto.customDates!.slice().sort((a, b) => a.getTime() - b.getTime());
    }

    const intervalMs = this.intervalMs(dto);
    const dates: Date[] = [];
    let current = new Date(dto.scheduledAt);

    if (dto.occurrences !== undefined) {
      for (let i = 0; i < dto.occurrences; i++) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + intervalMs);
      }
    } else {
      const until = dto.until!.getTime();
      while (current.getTime() <= until) {
        dates.push(new Date(current));
        current = new Date(current.getTime() + intervalMs);
      }
    }

    return dates;
  }

  private intervalMs(dto: CreateRecurringBookingDto): number {
    if (dto.intervalDays !== undefined) {
      return dto.intervalDays * 86400_000;
    }
    switch (dto.frequency) {
      case RecurringFrequency.WEEKLY: return 7 * 86400_000;
      case RecurringFrequency.DAILY:  return 86400_000;
      default: throw new BadRequestException(`Unsupported frequency: ${dto.frequency as string}`);
    }
  }
}
