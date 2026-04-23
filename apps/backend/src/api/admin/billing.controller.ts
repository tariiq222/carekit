import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { ListSubscriptionsHandler } from '../../modules/platform/admin/list-subscriptions/list-subscriptions.handler';
import { GetOrgBillingHandler } from '../../modules/platform/admin/get-org-billing/get-org-billing.handler';
import { ListSubscriptionInvoicesHandler } from '../../modules/platform/admin/list-subscription-invoices/list-subscription-invoices.handler';
import { GetBillingMetricsHandler } from '../../modules/platform/admin/get-billing-metrics/get-billing-metrics.handler';
import {
  ListSubscriptionInvoicesQueryDto,
  ListSubscriptionsQueryDto,
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
}
