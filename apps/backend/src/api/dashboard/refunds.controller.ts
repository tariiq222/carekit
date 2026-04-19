import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ListRefundsHandler } from '../../modules/finance/refund-payment/list-refunds.handler';
import { ApproveRefundHandler } from '../../modules/finance/refund-payment/approve-refund.handler';
import { DenyRefundHandler } from '../../modules/finance/refund-payment/deny-refund.handler';

class ApproveRefundDto {
  refundRequestId!: string;
}

class DenyRefundDto {
  refundRequestId!: string;
  reason!: string;
}

@ApiTags('Dashboard / Refunds')
@Controller('refunds')
export class RefundsController {
  constructor(
    private readonly listRefundsHandler: ListRefundsHandler,
    private readonly approveRefundHandler: ApproveRefundHandler,
    private readonly denyRefundHandler: DenyRefundHandler,
  ) {}

  @UseGuards(JwtGuard)
  @Get()
  @ApiOperation({ summary: 'List all refund requests' })
  async listRefunds(@Query('status') status?: string) {
    return this.listRefundsHandler.execute(status);
  }

  @UseGuards(JwtGuard)
  @Post('approve')
  @ApiOperation({ summary: 'Approve a refund request' })
  async approveRefund(
    @Body() dto: ApproveRefundDto,
    @Body('processedBy') processedBy: string,
  ) {
    return this.approveRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      approvedBy: processedBy,
    });
  }

  @UseGuards(JwtGuard)
  @Post('deny')
  @ApiOperation({ summary: 'Deny a refund request' })
  async denyRefund(
    @Body() dto: DenyRefundDto,
    @Body('processedBy') processedBy: string,
  ) {
    return this.denyRefundHandler.execute({
      refundRequestId: dto.refundRequestId,
      deniedBy: processedBy,
      reason: dto.reason,
    });
  }
}