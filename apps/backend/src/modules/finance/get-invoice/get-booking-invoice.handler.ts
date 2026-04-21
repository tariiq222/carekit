import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetPublicInvoiceResult } from './get-public-invoice.handler';

@Injectable()
export class GetBookingInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(bookingId: string, clientId: string): Promise<GetPublicInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        bookingId,
        clientId,
      },
      include: {
        zatcaSub: {
          select: {
            qrCode: true,
            status: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice for booking ${bookingId} not found`);
    }

    return {
      id: invoice.id,
      branchId: invoice.branchId,
      clientId: invoice.clientId,
      employeeId: invoice.employeeId,
      bookingId: invoice.bookingId,
      subtotal: Number(invoice.subtotal),
      discountAmt: Number(invoice.discountAmt),
      vatRate: Number(invoice.vatRate),
      vatAmt: Number(invoice.vatAmt),
      total: Number(invoice.total),
      currency: invoice.currency,
      status: invoice.status,
      issuedAt: invoice.issuedAt?.toISOString() ?? null,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      qrCode: invoice.zatcaSub?.qrCode ?? null,
      zatcaStatus: invoice.zatcaSub?.status ?? null,
    };
  }
}
