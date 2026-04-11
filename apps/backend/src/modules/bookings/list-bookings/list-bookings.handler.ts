import { Injectable } from '@nestjs/common';
import { BookingStatus, BookingType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListBookingsQuery {
  tenantId: string;
  page: number;
  limit: number;
  clientId?: string;
  employeeId?: string;
  branchId?: string;
  serviceId?: string;
  status?: BookingStatus;
  bookingType?: BookingType;
  fromDate?: Date;
  toDate?: Date;
}

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

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
