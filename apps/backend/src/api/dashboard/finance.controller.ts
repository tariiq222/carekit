import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { CreateInvoiceDto } from '../../modules/finance/create-invoice/create-invoice.dto';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ProcessPaymentDto } from '../../modules/finance/process-payment/process-payment.dto';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { ListPaymentsDto } from '../../modules/finance/list-payments/list-payments.dto';
import { ApplyCouponHandler } from '../../modules/finance/apply-coupon/apply-coupon.handler';
import { ApplyCouponDto } from '../../modules/finance/apply-coupon/apply-coupon.dto';
import { ZatcaSubmitHandler } from '../../modules/finance/zatca-submit/zatca-submit.handler';
import { ZatcaSubmitDto } from '../../modules/finance/zatca-submit/zatca-submit.dto';

@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/finance')
export class DashboardFinanceController {
  constructor(
    private readonly createInvoice: CreateInvoiceHandler,
    private readonly getInvoice: GetInvoiceHandler,
    private readonly processPayment: ProcessPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly applyCoupon: ApplyCouponHandler,
    private readonly zatcaSubmit: ZatcaSubmitHandler,
  ) {}

  @Post('invoices')
  createInv(@TenantId() tenantId: string, @Body() body: CreateInvoiceDto) {
    return this.createInvoice.execute({
      tenantId,
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    });
  }

  @Get('invoices/:id')
  getInv(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getInvoice.execute({ tenantId, invoiceId: id });
  }

  @Post('payments')
  processPaymentEndpoint(
    @TenantId() tenantId: string,
    @Body() body: ProcessPaymentDto,
  ) {
    return this.processPayment.execute({ tenantId, ...body });
  }

  @Get('payments')
  listPaymentsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListPaymentsDto,
  ) {
    return this.listPayments.execute({
      tenantId,
      page: query.page,
      limit: query.limit,
      invoiceId: query.invoiceId,
      clientId: query.clientId,
      method: query.method,
      status: query.status,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
    });
  }

  @Post('coupons/apply')
  applyCouponEndpoint(
    @TenantId() tenantId: string,
    @Body() body: ApplyCouponDto,
  ) {
    return this.applyCoupon.execute({ tenantId, ...body });
  }

  @Post('zatca/submit')
  zatca(@TenantId() tenantId: string, @Body() body: ZatcaSubmitDto) {
    return this.zatcaSubmit.execute({ tenantId, ...body });
  }
}
