import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

    // Derive price and duration from the Service — callers cannot dictate these.
    // Temporary until PriceResolver (p11-t5) handles coupons, gift cards, etc.
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (service.tenantId !== dto.tenantId) {
      throw new ForbiddenException('Service does not belong to tenant');
    }

    const durationMins = service.durationMins;
    const price = service.price;
    const currency = dto.currency ?? service.currency;

    const endsAt = new Date(scheduledAt.getTime() + durationMins * 60_000);

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
        durationMins,
        price,
        currency,
        bookingType: dto.bookingType ?? 'INDIVIDUAL',
        notes: dto.notes,
        expiresAt: dto.expiresAt,
        groupSessionId: dto.groupSessionId,
        status: 'PENDING',
      },
    });
  }
}
