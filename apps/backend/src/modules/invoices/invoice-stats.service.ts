import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class InvoiceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getInvoiceStats() {
    const [total, sent, zatcaGroups] = await Promise.all([
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { sentAt: { not: null } } }),
      this.prisma.invoice.groupBy({
        by: ['zatcaStatus' as const],
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      sent,
      pending: total - sent,
      zatca: Object.fromEntries(
        zatcaGroups.map((g) => [g.zatcaStatus, g._count._all]),
      ),
    };
  }
}
