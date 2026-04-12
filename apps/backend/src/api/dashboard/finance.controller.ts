import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
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
import { ListCouponsHandler } from '../../modules/finance/coupons/list-coupons.handler';
import { ListCouponsDto } from '../../modules/finance/coupons/list-coupons.dto';
import { GetCouponHandler } from '../../modules/finance/coupons/get-coupon.handler';
import { CreateCouponHandler } from '../../modules/finance/coupons/create-coupon.handler';
import { CreateCouponDto } from '../../modules/finance/coupons/create-coupon.dto';
import { UpdateCouponHandler } from '../../modules/finance/coupons/update-coupon.handler';
import { UpdateCouponDto } from '../../modules/finance/coupons/update-coupon.dto';
import { DeleteCouponHandler } from '../../modules/finance/coupons/delete-coupon.handler';
import { GetZatcaConfigHandler } from '../../modules/finance/zatca-config/get-zatca-config.handler';
import { UpsertZatcaConfigHandler } from '../../modules/finance/zatca-config/upsert-zatca-config.handler';
import { UpsertZatcaConfigDto } from '../../modules/finance/zatca-config/upsert-zatca-config.dto';
import { OnboardZatcaHandler } from '../../modules/finance/zatca-config/onboard-zatca.handler';
import { GetPaymentStatsHandler } from '../../modules/finance/get-payment-stats/get-payment-stats.handler';

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
    private readonly listCoupons: ListCouponsHandler,
    private readonly getCoupon: GetCouponHandler,
    private readonly createCoupon: CreateCouponHandler,
    private readonly updateCoupon: UpdateCouponHandler,
    private readonly deleteCoupon: DeleteCouponHandler,
    private readonly getZatcaConfig: GetZatcaConfigHandler,
    private readonly upsertZatcaConfig: UpsertZatcaConfigHandler,
    private readonly onboardZatca: OnboardZatcaHandler,
    private readonly getPaymentStats: GetPaymentStatsHandler,
  ) {}

  // ── Invoices ──────────────────────────────────────────────────────────────

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

  // ── Payments ──────────────────────────────────────────────────────────────

  @Get('payments/stats')
  getPaymentStatsEndpoint(@TenantId() tenantId: string) {
    return this.getPaymentStats.execute({ tenantId });
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

  // ── Coupons apply (existing) ───────────────────────────────────────────────

  @Post('coupons/apply')
  applyCouponEndpoint(
    @TenantId() tenantId: string,
    @Body() body: ApplyCouponDto,
  ) {
    return this.applyCoupon.execute({ tenantId, ...body });
  }

  // ── Coupons CRUD ──────────────────────────────────────────────────────────

  @Get('coupons')
  listCouponsEndpoint(@TenantId() tenantId: string, @Query() query: ListCouponsDto) {
    return this.listCoupons.execute({ tenantId, ...query });
  }

  @Get('coupons/:id')
  getCouponEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getCoupon.execute({ tenantId, couponId: id });
  }

  @Post('coupons')
  @HttpCode(HttpStatus.CREATED)
  createCouponEndpoint(@TenantId() tenantId: string, @Body() body: CreateCouponDto) {
    return this.createCoupon.execute({ tenantId, ...body });
  }

  @Patch('coupons/:id')
  updateCouponEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCouponDto,
  ) {
    return this.updateCoupon.execute({ tenantId, couponId: id, ...body });
  }

  @Delete('coupons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCouponEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteCoupon.execute({ tenantId, couponId: id });
  }

  // ── ZATCA ─────────────────────────────────────────────────────────────────

  @Post('zatca/submit')
  zatca(@TenantId() tenantId: string, @Body() body: ZatcaSubmitDto) {
    return this.zatcaSubmit.execute({ tenantId, ...body });
  }

  @Get('zatca/config')
  getZatcaConfigEndpoint(@TenantId() tenantId: string) {
    return this.getZatcaConfig.execute({ tenantId });
  }

  @Patch('zatca/config')
  upsertZatcaConfigEndpoint(@TenantId() tenantId: string, @Body() body: UpsertZatcaConfigDto) {
    return this.upsertZatcaConfig.execute({ tenantId, ...body });
  }

  @Post('zatca/onboard')
  @HttpCode(HttpStatus.OK)
  onboardZatcaEndpoint(
    @TenantId() tenantId: string,
    @Body() body: { vatRegistrationNumber: string; sellerName: string },
  ) {
    return this.onboardZatca.execute({ tenantId, ...body });
  }
}
