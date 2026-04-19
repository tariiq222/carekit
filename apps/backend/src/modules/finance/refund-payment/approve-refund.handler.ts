import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';

export interface ApproveRefundCommand {
  refundRequestId: string;
  approvedBy: string;
}

export interface RefundApprovalResult {
  id: string;
  status: string;
  gatewayRef?: string;
}

@Injectable()
export class ApproveRefundHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasarClient: MoyasarApiClient,
  ) {}

  async execute(cmd: ApproveRefundCommand): Promise<RefundApprovalResult> {
    const refundRequest = await this.prisma.refundRequest.findFirst({
      where: {
        id: cmd.refundRequestId,
        status: 'PENDING_REVIEW',
      },
    });

    if (!refundRequest) {
      throw new NotFoundException('Refund request not found or not pending review');
    }

    await this.prisma.refundRequest.update({
      where: { id: cmd.refundRequestId },
      data: {
        status: 'PROCESSING',
        processedBy: cmd.approvedBy,
        processedAt: new Date(),
      },
    });

    try {
      const moyasarRefund = await this.moyasarClient.createRefund({
        paymentId: refundRequest.paymentId,
        amount: Math.round(Number(refundRequest.amount) * 100),
      });

      const updated = await this.prisma.refundRequest.update({
        where: { id: cmd.refundRequestId },
        data: {
          status: 'COMPLETED',
          gatewayRef: moyasarRefund.id,
        },
      });

      await this.prisma.invoice.update({
        where: { id: refundRequest.invoiceId },
        data: { status: 'REFUNDED' },
      });

      await this.prisma.payment.update({
        where: { id: refundRequest.paymentId },
        data: { status: 'REFUNDED' },
      });

      return {
        id: updated.id,
        status: updated.status,
        gatewayRef: moyasarRefund.id,
      };
    } catch (error) {
      await this.prisma.refundRequest.update({
        where: { id: cmd.refundRequestId },
        data: {
          status: 'FAILED',
        },
      });

      throw error;
    }
  }
}