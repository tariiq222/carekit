import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class BookingExpiryCron {
  private readonly logger = new Logger(BookingExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: BookingStatus.EXPIRED,
      },
    });
    if (result.count > 0) {
      this.logger.log(`expired ${result.count} bookings`);
    }
  }
}
