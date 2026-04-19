import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetPublicInvoiceResult {
  id: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  bookingId: string;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  qrCode: string | null;
  zatcaStatus: string | null;
}

@Injectable()
export class GetPublicInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(invoiceId: string, clientId: string): Promise<GetPublicInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
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
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
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