import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { PaymentCompletedEvent } from '../events/payment-completed.event';
import type { ProcessPaymentDto } from './process-payment.dto';

@Injectable()
export class ProcessPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(dto: ProcessPaymentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
    });
    if (!invoice || invoice.tenantId !== dto.tenantId) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }
    if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.REFUNDED) {
      throw new BadRequestException(`Invoice ${dto.invoiceId} cannot accept payments (status: ${invoice.status})`);
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return existing;
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: dto.tenantId,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        gatewayRef: dto.gatewayRef,
        idempotencyKey: dto.idempotencyKey,
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    const totalPaid = await this.prisma.payment.aggregate({
      where: { invoiceId: dto.invoiceId, status: 'COMPLETED' },
      _sum: { amount: true },
    });

    const paid = Number(totalPaid._sum.amount ?? 0);
    const total = Number(invoice.total);
    const newStatus: InvoiceStatus = paid >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: {
        status: newStatus,
        paidAt: newStatus === InvoiceStatus.PAID ? new Date() : undefined,
      },
    });

    if (newStatus === InvoiceStatus.PAID) {
      const event = new PaymentCompletedEvent(dto.tenantId, {
        paymentId: payment.id,
        invoiceId: invoice.id,
        bookingId: invoice.bookingId,
        tenantId: dto.tenantId,
        amount: dto.amount,
        currency: invoice.currency,
      });
      await this.eventBus.publish(event.eventName, event.toEnvelope());
    }

    return payment;
  }
}
