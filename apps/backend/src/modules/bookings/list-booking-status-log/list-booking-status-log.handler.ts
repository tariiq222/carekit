import { Injectable } from '@nestjs/common';
import type { BookingStatusLog } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListBookingStatusLogQuery {
  tenantId: string;
  bookingId: string;
}

@Injectable()
export class ListBookingStatusLogHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingStatusLogQuery): Promise<BookingStatusLog[]> {
    return this.prisma.bookingStatusLog.findMany({
      where: { tenantId: query.tenantId, bookingId: query.bookingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
