import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetBookingQuery {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class GetBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingQuery) {
    const booking = await this.prisma.booking.findUnique({ where: { id: query.bookingId } });
    if (!booking || booking.tenantId !== query.tenantId) {
      throw new NotFoundException(`Booking ${query.bookingId} not found`);
    }
    return booking;
  }
}
