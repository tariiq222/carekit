import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { ValidateLicenseService } from './license/validate-license.service';
import { CheckFeatureHandler } from './license/check-feature.handler';
import { CreateProblemReportHandler } from './problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from './problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from './problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from './integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from './integrations/list-integrations.handler';

@Module({
  imports: [DatabaseModule],
  providers: [
    ValidateLicenseService,
    CheckFeatureHandler,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
  ],
  exports: [
    ValidateLicenseService,
    CheckFeatureHandler,
    CreateProblemReportHandler,
    ListProblemReportsHandler,
    UpdateProblemReportStatusHandler,
    UpsertIntegrationHandler,
    ListIntegrationsHandler,
  ],
})
export class PlatformModule {}
