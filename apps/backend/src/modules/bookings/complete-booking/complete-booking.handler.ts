import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CompleteBookingDto } from './complete-booking.dto';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export type CompleteBookingCommand = CompleteBookingDto & {
  tenantId: string;
  bookingId: string;
  changedBy: string;
};

@Injectable()
export class CompleteBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, cmd.tenantId, [BookingStatus.CONFIRMED], 'completed');

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
          ...(cmd.completionNotes && { notes: cmd.completionNotes }),
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.COMPLETED,
          changedBy: cmd.changedBy,
        },
      }),
    ]);
    return updated;
  }
}
