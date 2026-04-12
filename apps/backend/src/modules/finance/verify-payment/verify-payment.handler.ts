import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

interface VerifyPaymentCommand {
  tenantId: string;
  paymentId: string;
  action: 'approve' | 'reject';
  transferRef?: string;
}

@Injectable()
export class VerifyPaymentHandler {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.payment.update({
      where: { id: cmd.paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        processedAt: new Date(),
        gatewayRef: cmd.transferRef ?? payment.gatewayRef,
      },
    });
  }
}
