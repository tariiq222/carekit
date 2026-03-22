import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { InvoiceFilterDto } from './dto/invoice-filter.dto.js';
import { invoiceInclude } from './invoice.constants.js';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: InvoiceFilterDto) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {};

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
      if (query.dateTo) dateFilter.lte = new Date(query.dateTo);
      where.createdAt = dateFilter;
    }

    if (query.zatcaStatus) {
      where.zatcaStatus = query.zatcaStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'NOT_FOUND',
      });
    }

    return invoice;
  }

  async findByPayment(paymentId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { paymentId },
      include: invoiceInclude,
    });

    if (!invoice) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Invoice not found for this payment',
        error: 'NOT_FOUND',
      });
    }

    return invoice;
  }

  async markAsSent(id: string) {
    await this.findOne(id);

    return this.prisma.invoice.update({
      where: { id },
      data: { sentAt: new Date() },
      include: invoiceInclude,
    });
  }
}
