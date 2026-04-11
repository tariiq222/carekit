import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateBookingDto } from './create-booking.dto';

@Injectable()
export class CreateBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateBookingDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    const endsAt = new Date(scheduledAt.getTime() + dto.durationMins * 60_000);

    // Correct overlap: existing booking overlaps if it starts before our slot ends
    // AND its own endsAt is after our slot start.
    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: dto.tenantId,
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: endsAt },
        endsAt: { gt: scheduledAt },
      },
    });
    if (conflict) {
      throw new ConflictException('Employee already has a booking in this time slot');
    }

    return this.prisma.booking.create({
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
        groupSessionId: dto.groupSessionId,
        status: 'PENDING',
      },
    });
  }
}
