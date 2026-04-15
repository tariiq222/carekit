import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListBookingsDto } from './list-bookings.dto';

export type ListBookingsQuery = Omit<ListBookingsDto, 'page' | 'limit' | 'fromDate' | 'toDate'> & {
  tenantId: string;
  page: number;
  limit: number;
  fromDate?: Date;
  toDate?: Date;
};

@Injectable()
export class ListBookingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListBookingsQuery) {
    const where = {
      tenantId: query.tenantId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.bookingType ? { bookingType: query.bookingType } : {}),
      ...(query.fromDate || query.toDate
        ? { scheduledAt: { gte: query.fromDate, lte: query.toDate } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return toListResponse(items, total, query.page, query.limit);
  }
}
