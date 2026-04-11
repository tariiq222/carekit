import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import type { CreateInvoiceDto } from './create-invoice.dto';

const DEFAULT_VAT_RATE = 0.15;

@Injectable()
export class CreateInvoiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: CreateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) throw new ConflictException(`Invoice already exists for booking ${dto.bookingId}`);

    const subtotal = dto.subtotal;
    const discountAmt = dto.discountAmt ?? 0;
    const vatRate = dto.vatRate ?? DEFAULT_VAT_RATE;
    const vatBase = subtotal - discountAmt;
    const vatAmt = parseFloat((vatBase * vatRate).toFixed(2));
    const total = parseFloat((vatBase + vatAmt).toFixed(2));

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        clientId: dto.clientId,
        employeeId: dto.employeeId,
        bookingId: dto.bookingId,
        subtotal,
        discountAmt,
        vatRate,
        vatAmt,
        total,
        notes: dto.notes,
        dueAt: dto.dueAt,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });

    await this.eventBus.publish('finance.invoice.created', {
      eventId: invoice.id,
      source: 'finance',
      version: 1,
      tenantId: invoice.tenantId,
      occurredAt: new Date(),
      payload: {
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        clientId: invoice.clientId,
        total: Number(invoice.total),
      },
    });

    return invoice;
  }
}
