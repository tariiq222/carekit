import { Module } from '@nestjs/common';
import { DashboardPlatformController } from '../../api/dashboard/platform.controller';
import { DashboardVerticalsController } from '../../api/dashboard/verticals.controller';
import { AdminOrganizationsController } from '../../api/admin/organizations.controller';
import { AdminUsersController } from '../../api/admin/users.controller';
import { AdminPlansController } from '../../api/admin/plans.controller';
import { AdminVerticalsController } from '../../api/admin/verticals.controller';
import { AdminMetricsController } from '../../api/admin/metrics.controller';
import { AdminAuditLogController } from '../../api/admin/audit-log.controller';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { AdminHostGuard, SuperAdminGuard } from '../../common/guards';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { TenantModule } from '../../common/tenant';
import { PasswordService } from '../identity/shared/password.service';
import { VerticalsModule } from './verticals/verticals.module';
import { CreateProblemReportHandler } from './problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from './problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from './integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from './integrations/list-integrations.handler';
import { ListFeatureFlagsHandler } from './feature-flags/list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './feature-flags/get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './feature-flags/update-feature-flag.handler';
import { ListOrganizationsHandler } from './admin/list-organizations/list-organizations.handler';
import { GetOrganizationHandler } from './admin/get-organization/get-organization.handler';
import { SuspendOrganizationHandler } from './admin/suspend-organization/suspend-organization.handler';
import { ReinstateOrganizationHandler } from './admin/reinstate-organization/reinstate-organization.handler';
import { SearchUsersHandler } from './admin/search-users/search-users.handler';
import { ResetUserPasswordHandler } from './admin/reset-user-password/reset-user-password.handler';
import { ListPlansAdminHandler } from './admin/list-plans/list-plans-admin.handler';
import { CreatePlanHandler } from './admin/create-plan/create-plan.handler';
import { UpdatePlanHandler } from './admin/update-plan/update-plan.handler';
import { DeletePlanHandler } from './admin/delete-plan/delete-plan.handler';
import { ListVerticalsAdminHandler } from './admin/list-verticals/list-verticals-admin.handler';
import { CreateVerticalAdminHandler } from './admin/create-vertical/create-vertical-admin.handler';
import { UpdateVerticalAdminHandler } from './admin/update-vertical/update-vertical-admin.handler';
import { DeleteVerticalAdminHandler } from './admin/delete-vertical/delete-vertical-admin.handler';
import { GetPlatformMetricsHandler } from './admin/get-platform-metrics/get-platform-metrics.handler';
import { ListAuditLogHandler } from './admin/list-audit-log/list-audit-log.handler';

const ADMIN_HANDLERS = [
  ListOrganizationsHandler,
  GetOrganizationHandler,
  SuspendOrganizationHandler,
  ReinstateOrganizationHandler,
  SearchUsersHandler,
  ResetUserPasswordHandler,
  ListPlansAdminHandler,
  CreatePlanHandler,
  UpdatePlanHandler,
  DeletePlanHandler,
  ListVerticalsAdminHandler,
  CreateVerticalAdminHandler,
  UpdateVerticalAdminHandler,
  DeleteVerticalAdminHandler,
  GetPlatformMetricsHandler,
  ListAuditLogHandler,
];

@Module({
  imports: [DatabaseModule, TenantModule, VerticalsModule],
  controllers: [
    DashboardPlatformController,
    DashboardVerticalsController,
    AdminOrganizationsController,
    AdminUsersController,
    AdminPlansController,
    AdminVerticalsController,
    AdminMetricsController,
    AdminAuditLogController,
  ],
  providers: [
    SuperAdminContextInterceptor,
    AdminHostGuard,
    SuperAdminGuard,
    RedisService,
    PasswordService,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
    ListFeatureFlagsHandler,
    GetFeatureFlagMapHandler,
    UpdateFeatureFlagHandler,
    ...ADMIN_HANDLERS,
  ],
  exports: [
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
    ListFeatureFlagsHandler,
    GetFeatureFlagMapHandler,
    UpdateFeatureFlagHandler,
    ...ADMIN_HANDLERS,
  ],
})
export class PlatformModule {}
