import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetInvoiceQuery {
  tenantId: string;
  invoiceId: string;
}

@Injectable()
export class GetInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetInvoiceQuery) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: query.invoiceId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        zatcaSub: true,
      },
    });
    if (!invoice || invoice.tenantId !== query.tenantId) {
      throw new NotFoundException(`Invoice ${query.invoiceId} not found`);
    }
    return invoice;
  }
}
