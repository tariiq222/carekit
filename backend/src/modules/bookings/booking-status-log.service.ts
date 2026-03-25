import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class BookingStatusLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    bookingId: string;
    fromStatus?: string;
    toStatus: string;
    changedBy?: string;
    reason?: string;
  }): Promise<void> {
    await this.prisma.bookingStatusLog.create({
      data: {
        bookingId: params.bookingId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        changedBy: params.changedBy,
        reason: params.reason,
      },
    });
  }

  async findByBooking(bookingId: string) {
    return this.prisma.bookingStatusLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
