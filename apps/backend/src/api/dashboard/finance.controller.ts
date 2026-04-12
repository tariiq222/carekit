import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { ApplyCouponHandler } from '../../modules/finance/apply-coupon/apply-coupon.handler';
import { ZatcaSubmitHandler } from '../../modules/finance/zatca-submit/zatca-submit.handler';

export class CreateInvoiceBody {
  @IsUUID() bookingId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsNumber() subtotal!: number;
  @IsOptional() @IsNumber() discountAmt?: number;
  @IsOptional() @IsNumber() vatRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

export class ProcessPaymentBody {
  @IsUUID() invoiceId!: string;
  @IsNumber() amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() gatewayRef?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class ApplyCouponBody {
  @IsUUID() invoiceId!: string;
  @IsUUID() clientId!: string;
  @IsString() code!: string;
}

export class ListPaymentsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsUUID() invoiceId?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

export class ZatcaSubmitBody {
  @IsUUID() invoiceId!: string;
}

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
  createInv(@TenantId() tenantId: string, @Body() body: CreateInvoiceBody) {
    return this.createInvoice.execute({
      tenantId,
      bookingId: body.bookingId,
      branchId: body.branchId,
      clientId: body.clientId,
      employeeId: body.employeeId,
      subtotal: body.subtotal,
      discountAmt: body.discountAmt,
      vatRate: body.vatRate,
      notes: body.notes,
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
    @Body() body: ProcessPaymentBody,
  ) {
    return this.processPayment.execute({
      tenantId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      method: body.method,
      gatewayRef: body.gatewayRef,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Get('payments')
  listPaymentsEndpoint(
    @TenantId() tenantId: string,
    @Query() q: ListPaymentsQueryDto,
  ) {
    return this.listPayments.execute({
      tenantId,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
      invoiceId: q.invoiceId,
      clientId: q.clientId,
      method: q.method,
      status: q.status,
      fromDate: q.fromDate ? new Date(q.fromDate) : undefined,
      toDate: q.toDate ? new Date(q.toDate) : undefined,
    });
  }

  @Post('coupons/apply')
  applyCouponEndpoint(
    @TenantId() tenantId: string,
    @Body() body: ApplyCouponBody,
  ) {
    return this.applyCoupon.execute({
      tenantId,
      invoiceId: body.invoiceId,
      clientId: body.clientId,
      code: body.code,
    });
  }

  @Post('zatca/submit')
  zatca(@TenantId() tenantId: string, @Body() body: ZatcaSubmitBody) {
    return this.zatcaSubmit.execute({ tenantId, invoiceId: body.invoiceId });
  }
}
