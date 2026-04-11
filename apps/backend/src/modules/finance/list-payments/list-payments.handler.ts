import { Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ListPaymentsQuery {
  tenantId: string;
  page: number;
  limit: number;
  invoiceId?: string;
  clientId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  fromDate?: Date;
  toDate?: Date;
}

@Injectable()
export class ListPaymentsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListPaymentsQuery) {
    const where = {
      tenantId: query.tenantId,
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId
        ? { invoice: { clientId: query.clientId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? { createdAt: { gte: query.fromDate, lte: query.toDate } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { invoice: { select: { bookingId: true, clientId: true, total: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }
}
