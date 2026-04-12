import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CheckInBookingCommand {
  tenantId: string;
  bookingId: string;
  changedBy: string;
}

/** Receptionist marks client as arrived — transitions CONFIRMED → CONFIRMED with checkedInAt timestamp. */
@Injectable()
export class CheckInBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CheckInBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Only CONFIRMED bookings can be checked in (status: ${booking.status})`);
    }
    if (booking.checkedInAt) {
      throw new BadRequestException('Booking is already checked in');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: cmd.bookingId },
        data: { checkedInAt: new Date() },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          tenantId: cmd.tenantId,
          bookingId: cmd.bookingId,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.CONFIRMED,
          changedBy: cmd.changedBy,
          reason: 'checked-in',
        },
      }),
    ]);
    return updated;
  }
}
