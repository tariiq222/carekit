import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

interface PaymentStats {
  total: number;
  totalAmount: number;
  paid: number;
  paidAmount: number;
  pending: number;
  pendingAmount: number;
  refunded: number;
  refundedAmount: number;
}

@Injectable()
export class GetPaymentStatsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ tenantId }: { tenantId: string }): Promise<PaymentStats> {
    const rows = await this.prisma.payment.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
      _sum: { amount: true },
    });

    const stats: PaymentStats = {
      total: 0,
      totalAmount: 0,
      paid: 0,
      paidAmount: 0,
      pending: 0,
      pendingAmount: 0,
      refunded: 0,
      refundedAmount: 0,
    };

    for (const row of rows) {
      const count = row._count.id;
      const amount = row._sum.amount?.toNumber() ?? 0;
      stats.total += count;
      stats.totalAmount += amount;

      if (row.status === 'PAID') {
        stats.paid = count;
        stats.paidAmount = amount;
      } else if (row.status === 'PENDING') {
        stats.pending = count;
        stats.pendingAmount = amount;
      } else if (row.status === 'REFUNDED') {
        stats.refunded = count;
        stats.refundedAmount = amount;
      }
    }

    return stats;
  }
}
