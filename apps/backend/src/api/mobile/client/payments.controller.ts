import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ListPaymentsHandler } from '../../../modules/finance/list-payments/list-payments.handler';
import { GetInvoiceHandler } from '../../../modules/finance/get-invoice/get-invoice.handler';

export class MobileListPaymentsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@UseGuards(JwtGuard)
@Controller('mobile/client/payments')
export class MobileClientPaymentsController {
  constructor(
    private readonly listPayments: ListPaymentsHandler,
    private readonly getInvoice: GetInvoiceHandler,
  ) {}

  @Get()
  listMyPayments(
    @CurrentUser() user: JwtUser,
    @Query() q: MobileListPaymentsQuery,
  ) {
    return this.listPayments.execute({
      clientId: user.sub,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @Get('invoices/:id')
  getInvoiceEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getInvoice.execute({ invoiceId: id });
  }
}
