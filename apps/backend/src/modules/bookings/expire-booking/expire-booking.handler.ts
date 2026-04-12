import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export interface ExpireBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, cmd.tenantId, [BookingStatus.PENDING], 'expired');

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
