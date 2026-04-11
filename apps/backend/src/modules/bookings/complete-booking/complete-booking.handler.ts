import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CompleteBookingCommand {
  tenantId: string;
  bookingId: string;
  completionNotes?: string;
}

const COMPLETABLE_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED];

@Injectable()
export class CompleteBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await this.prisma.booking.findUnique({ where: { id: cmd.bookingId } });
    if (!booking || booking.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    if (!COMPLETABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(`Booking cannot be completed (status: ${booking.status})`);
    }

    return this.prisma.booking.update({
      where: { id: cmd.bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
        ...(cmd.completionNotes && { notes: cmd.completionNotes }),
      },
    });
  }
}
