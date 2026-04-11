import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface RescheduleBookingCommand {
  tenantId: string;
  bookingId: string;
  newScheduledAt: Date;
  newDurationMins?: number;
}

@Injectable()
export class RescheduleBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RescheduleBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Booking cannot be rescheduled (status: ${booking.status})`);
    }

    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const durationMins = cmd.newDurationMins ?? booking.durationMins;
    const newEndsAt = new Date(newScheduledAt.getTime() + durationMins * 60_000);

    // Correct overlap: existing booking overlaps if it starts before our slot ends
    // AND its endsAt is after our new slot start.
    const conflict = await this.prisma.booking.findFirst({
      where: {
        tenantId: cmd.tenantId,
        employeeId: booking.employeeId,
        id: { not: cmd.bookingId },
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { lt: newEndsAt },
        endsAt: { gt: newScheduledAt },
      },
    });
    if (conflict) throw new ConflictException('Employee already has a booking in the new time slot');

    return this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
    });
  }
}
