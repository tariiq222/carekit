import { Module } from '@nestjs/common';
import { DashboardPlatformController } from '../../api/dashboard/platform.controller';
import { DatabaseModule } from '../../infrastructure/database';
import { CreateProblemReportHandler } from './problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from './problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from './integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from './integrations/list-integrations.handler';
import { ListFeatureFlagsHandler } from './feature-flags/list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './feature-flags/get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './feature-flags/update-feature-flag.handler';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardPlatformController],
  providers: [
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
    ListFeatureFlagsHandler,
    GetFeatureFlagMapHandler,
    UpdateFeatureFlagHandler,
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
  ],
})
export class PlatformModule {}
