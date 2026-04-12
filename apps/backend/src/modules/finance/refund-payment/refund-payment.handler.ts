import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

interface RefundPaymentCommand {
  tenantId: string;
  paymentId: string;
  reason: string;
  amount?: number;
}

@Injectable()
export class RefundPaymentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: RefundPaymentCommand) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: cmd.paymentId, tenantId: cmd.tenantId },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    return this.prisma.payment.update({
      where: { id: cmd.paymentId },
      data: { status: PaymentStatus.REFUNDED, failureReason: cmd.reason },
    });
  }
}
