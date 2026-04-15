import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { PaymentCompletedEvent } from '../events/payment-completed.event';

interface VerifyPaymentCommand {
  tenantId: string;
  paymentId: string;
  action: 'approve' | 'reject';
  transferRef?: string;
}

@Injectable()
export class VerifyPaymentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: VerifyPaymentCommand) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: cmd.paymentId, tenantId: cmd.tenantId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('Payment is not pending verification');
    }

    if (cmd.action === 'reject') {
      return this.prisma.payment.update({
        where: { id: cmd.paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: 'Bank transfer rejected',
        },
      });
    }

    // Approve path: mirror ProcessPaymentHandler — mark the payment COMPLETED,
    // recompute invoice.status from the sum of completed payments, and flip the
    // invoice to PAID/PARTIALLY_PAID atomically. Without this, downstream
    // consumers (ZATCA submit, reports, booking confirmation) see a stuck
    // ISSUED invoice even though the money has been received.
    const { updatedPayment, newInvoiceStatus } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.payment.update({
          where: { id: cmd.paymentId },
          data: {
            status: PaymentStatus.COMPLETED,
            processedAt: new Date(),
            gatewayRef: cmd.transferRef ?? payment.gatewayRef,
          },
        });

        const invoice = await tx.invoice.findFirst({
          where: { id: payment.invoiceId, tenantId: cmd.tenantId },
        });
        if (!invoice) {
          throw new NotFoundException(`Invoice ${payment.invoiceId} not found`);
        }

        const totalPaid = await tx.payment.aggregate({
          where: { invoiceId: payment.invoiceId, status: PaymentStatus.COMPLETED },
          _sum: { amount: true },
        });

        const paid = Number(totalPaid._sum.amount ?? 0);
        const total = Number(invoice.total);
        const status: InvoiceStatus =
          paid >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status,
            paidAt: status === InvoiceStatus.PAID ? new Date() : undefined,
          },
        });

        return { updatedPayment: updated, newInvoiceStatus: status };
      },
    );

    if (newInvoiceStatus === InvoiceStatus.PAID) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { id: true, bookingId: true, currency: true },
      });
      if (invoice) {
        const event = new PaymentCompletedEvent(cmd.tenantId, {
          paymentId: updatedPayment.id,
          invoiceId: invoice.id,
          bookingId: invoice.bookingId,
          tenantId: cmd.tenantId,
          amount: Number(updatedPayment.amount),
          currency: invoice.currency,
        });
        await this.eventBus.publish(event.eventName, event.toEnvelope());
      }
    }

    return updatedPayment;
  }
}
