import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ExpireBookingCommand {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Only PENDING bookings can be expired (status: ${booking.status})`);
    }

    return this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: {
        status: BookingStatus.EXPIRED,
        expiresAt: new Date(),
      },
    });
  }
}
