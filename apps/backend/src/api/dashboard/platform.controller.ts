import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { CreateProblemReportDto } from '../../modules/platform/problem-reports/create-problem-report.dto';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { ListProblemReportsDto } from '../../modules/platform/problem-reports/list-problem-reports.dto';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpdateProblemReportStatusDto } from '../../modules/platform/problem-reports/update-problem-report-status.dto';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { UpsertIntegrationDto } from '../../modules/platform/integrations/upsert-integration.dto';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';
import { ListFeatureFlagsHandler } from '../../modules/platform/feature-flags/list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from '../../modules/platform/feature-flags/get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from '../../modules/platform/feature-flags/update-feature-flag.handler';
import { UpdateFeatureFlagDto } from '../../modules/platform/feature-flags/update-feature-flag.dto';

@ApiTags('Platform')
@ApiBearerAuth()
@Controller('dashboard/platform')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardPlatformController {
  constructor(
    private readonly createProblemReport: CreateProblemReportHandler,
    private readonly listProblemReports: ListProblemReportsHandler,
    private readonly updateProblemReportStatus: UpdateProblemReportStatusHandler,
    private readonly upsertIntegration: UpsertIntegrationHandler,
    private readonly listIntegrations: ListIntegrationsHandler,
    private readonly listFeatureFlags: ListFeatureFlagsHandler,
    private readonly getFeatureFlagMap: GetFeatureFlagMapHandler,
    private readonly updateFeatureFlag: UpdateFeatureFlagHandler,
  ) {}

  // ── Problem Reports ──────────────────────────────────────────────────────────

  @Post('problem-reports')
  @HttpCode(HttpStatus.CREATED)
  createProblemReportEndpoint(@Body() body: CreateProblemReportDto) {
    return this.createProblemReport.execute(body);
  }

  @Get('problem-reports')
  listProblemReportsEndpoint(@Query() query: ListProblemReportsDto) {
    return this.listProblemReports.execute(query);
  }

  @Patch('problem-reports/:id/status')
  updateProblemReportStatusEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProblemReportStatusDto,
  ) {
    return this.updateProblemReportStatus.execute({ id, ...body });
  }

  // ── Integrations ─────────────────────────────────────────────────────────────

  @Post('integrations')
  @HttpCode(HttpStatus.OK)
  upsertIntegrationEndpoint(@Body() body: UpsertIntegrationDto) {
    return this.upsertIntegration.execute(body);
  }

  @Get('integrations')
  listIntegrationsEndpoint() {
    return this.listIntegrations.execute();
  }

  // ── Feature Flags ──────────────────────────────────────────────────────────

  @Get('feature-flags')
  async listFeatureFlagsEndpoint() {
    return this.listFeatureFlags.execute();
  }

  @Get('feature-flags/map')
  async featureFlagMapEndpoint() {
    return this.getFeatureFlagMap.execute();
  }

  @Patch('feature-flags/:key')
  async updateFeatureFlagEndpoint(
    @Param('key') key: string,
    @Body() body: UpdateFeatureFlagDto,
  ) {
    return this.updateFeatureFlag.execute({ key, enabled: body.enabled });
  }
}
