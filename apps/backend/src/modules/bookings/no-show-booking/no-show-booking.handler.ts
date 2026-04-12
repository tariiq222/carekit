import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface NoShowBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId, tenantId: cmd.tenantId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Only CONFIRMED bookings can be marked as no-show (status: ${booking.status})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.NO_SHOW,
          changedBy: cmd.changedBy,
        },
      }),
    ]);
    return updated;
  }
}
