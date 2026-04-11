import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateBookingDto } from './create-booking.dto';

const BUFFER_MINUTES = 0;

@Injectable()
export class CreateBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateBookingDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Booking must be scheduled in the future');
    }

    const slotEnd = new Date(scheduledAt.getTime() + (dto.durationMins + BUFFER_MINUTES) * 60_000);

    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: dto.tenantId,
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        AND: [
          { scheduledAt: { lt: slotEnd } },
          {
            scheduledAt: {
              gte: new Date(scheduledAt.getTime() - dto.durationMins * 60_000),
            },
          },
        ],
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
