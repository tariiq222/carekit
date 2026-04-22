import { Module } from '@nestjs/common';
import { DashboardPlatformController } from '../../api/dashboard/platform.controller';
import { DashboardVerticalsController } from '../../api/dashboard/verticals.controller';
import { AdminOrganizationsController } from '../../api/admin/organizations.controller';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { AdminHostGuard, SuperAdminGuard } from '../../common/guards';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { TenantModule } from '../../common/tenant';
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

@Module({
  imports: [DatabaseModule, TenantModule, VerticalsModule],
  controllers: [
    DashboardPlatformController,
    DashboardVerticalsController,
    AdminOrganizationsController,
  ],
  providers: [
    SuperAdminContextInterceptor,
    AdminHostGuard,
    SuperAdminGuard,
    RedisService,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
    ListFeatureFlagsHandler,
    GetFeatureFlagMapHandler,
    UpdateFeatureFlagHandler,
    ListOrganizationsHandler,
    GetOrganizationHandler,
    SuspendOrganizationHandler,
    ReinstateOrganizationHandler,
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
    ListOrganizationsHandler,
    GetOrganizationHandler,
    SuspendOrganizationHandler,
    ReinstateOrganizationHandler,
  ],
})
export class PlatformModule {}
