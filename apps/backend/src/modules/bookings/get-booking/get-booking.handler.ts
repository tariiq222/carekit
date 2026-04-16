import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBookingQuery {
  bookingId: string;
}

@Injectable()
export class GetBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingQuery) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: query.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${query.bookingId} not found`);
    }
    return booking;
  }
}
