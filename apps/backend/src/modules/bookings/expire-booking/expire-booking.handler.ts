import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ExpireBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId, tenantId: cmd.tenantId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(`Only PENDING bookings can be expired (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.EXPIRED, expiresAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.EXPIRED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);
    return updated;
  }
}
