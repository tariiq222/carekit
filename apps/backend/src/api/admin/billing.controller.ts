import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ListSubscriptionsHandler } from '../../modules/platform/admin/list-subscriptions/list-subscriptions.handler';
import { GetOrgBillingHandler } from '../../modules/platform/admin/get-org-billing/get-org-billing.handler';
import { ListSubscriptionInvoicesHandler } from '../../modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler';
import { GetBillingMetricsHandler } from '../../modules/platform/admin/get-billing-metrics/get-billing-metrics.handler';
import { AdminWaiveInvoiceHandler } from '../../modules/platform/admin/admin-waive-invoice/admin-waive-invoice.handler';
import { AdminGrantCreditHandler } from '../../modules/platform/admin/admin-grant-credit/admin-grant-credit.handler';
import { AdminChangePlanForOrgHandler } from '../../modules/platform/admin/admin-change-plan-for-org/admin-change-plan-for-org.handler';
import { AdminRefundInvoiceHandler } from '../../modules/platform/admin/admin-refund-invoice/admin-refund-invoice.handler';
import {
  ChangePlanForOrgDto,
  GrantCreditDto,
  ListSubscriptionInvoicesQueryDto,
  ListSubscriptionsQueryDto,
  RefundInvoiceDto,
  WaiveInvoiceDto,
} from './dto/billing.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/billing')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminBillingController {
  constructor(
    private readonly listSubs: ListSubscriptionsHandler,
    private readonly getOrgBilling: GetOrgBillingHandler,
    private readonly listInvoices: ListSubscriptionInvoicesHandler,
    private readonly getMetrics: GetBillingMetricsHandler,
    private readonly waiveInvoice: AdminWaiveInvoiceHandler,
    private readonly grantCredit: AdminGrantCreditHandler,
    private readonly changePlanForOrg: AdminChangePlanForOrgHandler,
    private readonly refundInvoice: AdminRefundInvoiceHandler,
  ) {}

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all subscriptions across tenants' })
  list(@Query() q: ListSubscriptionsQueryDto) {
    return this.listSubs.execute({
      page: q.page ?? 1,
      perPage: q.perPage ?? 20,
      status: q.status,
      planId: q.planId,
    });
  }

  @Get('subscriptions/:orgId')
  @ApiOperation({ summary: 'Get full billing detail for one organization' })
  getOrg(@Param('orgId') orgId: string) {
    return this.getOrgBilling.execute({ organizationId: orgId });
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List subscription invoices across tenants' })
  invoices(@Query() q: ListSubscriptionInvoicesQueryDto) {
    return this.listInvoices.execute({
      page: q.page ?? 1,
      perPage: q.perPage ?? 20,
      status: q.status,
      organizationId: q.organizationId,
      fromDate: q.fromDate,
      toDate: q.toDate,
      includeDrafts: q.includeDrafts ?? false,
    });
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Aggregate billing metrics (MRR, ARR, churn, by-plan)' })
  metrics() {
    return this.getMetrics.execute();
  }

  @Post('invoices/:id/waive')
  @ApiOperation({ summary: 'Waive a DUE/FAILED invoice (sets status=VOID; audited)' })
  waive(
    @Param('id') id: string,
    @Body() dto: WaiveInvoiceDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.waiveInvoice.execute({
      invoiceId: id,
      superAdminUserId: user.id,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post('credits')
  @ApiOperation({ summary: 'Grant a billing credit to an organization (audited)' })
  grant(
    @Body() dto: GrantCreditDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.grantCredit.execute({
      organizationId: dto.organizationId,
      amount: dto.amount,
      currency: dto.currency ?? 'SAR',
      reason: dto.reason,
      superAdminUserId: user.id,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post('invoices/:id/refund')
  @ApiOperation({
    summary: 'Refund a PAID invoice via Moyasar (full or partial; idempotent; audited)',
  })
  refund(
    @Param('id') id: string,
    @Body() dto: RefundInvoiceDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.refundInvoice.execute({
      invoiceId: id,
      amount: dto.amount,
      superAdminUserId: user.id,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Patch('subscriptions/:orgId/plan')
  @ApiOperation({ summary: 'Change an organization’s plan immediately (no proration; audited)' })
  changePlan(
    @Param('orgId') orgId: string,
    @Body() dto: ChangePlanForOrgDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    return this.changePlanForOrg.execute({
      organizationId: orgId,
      newPlanId: dto.newPlanId,
      superAdminUserId: user.id,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
