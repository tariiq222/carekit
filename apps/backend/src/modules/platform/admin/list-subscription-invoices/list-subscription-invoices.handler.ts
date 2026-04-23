import { Injectable } from '@nestjs/common';
import { SubscriptionInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListSubscriptionInvoicesQuery {
  page: number;
  perPage: number;
  status?: SubscriptionInvoiceStatus;
  organizationId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeDrafts?: boolean;
}

@Injectable()
export class ListSubscriptionInvoicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(q: ListSubscriptionInvoicesQuery) {
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    else if (!q.includeDrafts) where.status = { not: SubscriptionInvoiceStatus.DRAFT };
    if (q.organizationId) where.organizationId = q.organizationId;
    if (q.fromDate || q.toDate) {
      where.createdAt = {
        ...(q.fromDate ? { gte: q.fromDate } : {}),
        ...(q.toDate ? { lte: q.toDate } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.$allTenants.subscriptionInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          subscriptionId: true,
          organizationId: true,
          amount: true,
          flatAmount: true,
          overageAmount: true,
          currency: true,
          status: true,
          billingCycle: true,
          periodStart: true,
          periodEnd: true,
          dueDate: true,
          issuedAt: true,
          paidAt: true,
          refundedAmount: true,
          refundedAt: true,
          voidedReason: true,
          createdAt: true,
        },
      }),
      this.prisma.$allTenants.subscriptionInvoice.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / q.perPage),
      },
    };
  }
}
