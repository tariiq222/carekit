import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface DenyRefundCommand {
  refundRequestId: string;
  deniedBy: string;
  reason: string;
}

@Injectable()
export class DenyRefundHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DenyRefundCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const refundRequest = await this.prisma.refundRequest.findFirst({
      where: {
        id: cmd.refundRequestId,
        status: 'PENDING_REVIEW',
        organizationId,
      },
    });

    if (!refundRequest) {
      throw new NotFoundException('Refund request not found or not pending review');
    }

    return this.prisma.refundRequest.update({
      where: { id: cmd.refundRequestId },
      data: {
        status: 'DENIED',
        processedBy: cmd.deniedBy,
        processedAt: new Date(),
        denialReason: cmd.reason,
      },
    });
  }
}