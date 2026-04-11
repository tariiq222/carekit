import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface NoShowBookingCommand {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Only CONFIRMED bookings can be marked as no-show (status: ${booking.status})`);
    }

    return this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: {
        status: BookingStatus.NO_SHOW,
        noShowAt: new Date(),
      },
    });
  }
}
