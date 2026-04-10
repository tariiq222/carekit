import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { InvoiceFilterDto } from './dto/invoice-filter.dto.js';
import { invoiceInclude } from './invoice.constants.js';
import {
  parsePaginationParams,
  buildPaginationMeta,
} from '../../common/helpers/pagination.helper.js';
import { buildDateRangeFilter } from '../../common/helpers/date-filter.helper.js';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: InvoiceFilterDto) {
    const { page, perPage, skip } = parsePaginationParams(
      query.page,
      query.perPage,
    );

    const where: Record<string, unknown> = {};

    const dateRange = buildDateRangeFilter(query.dateFrom, query.dateTo);
    if (dateRange) where.createdAt = dateRange;

    if (query.zatcaStatus) {
      where.zatcaStatus = query.zatcaStatus;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        {
          payment: {
            booking: {
              patient: {
                OR: [
                  { firstName: { contains: term, mode: 'insensitive' } },
                  { lastName: { contains: term, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
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
      meta: buildPaginationMeta(total, page, perPage),
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
