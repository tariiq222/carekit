import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { CreateProblemReportDto } from '../../modules/platform/problem-reports/create-problem-report.dto';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { ListProblemReportsDto } from '../../modules/platform/problem-reports/list-problem-reports.dto';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpdateProblemReportStatusDto } from '../../modules/platform/problem-reports/update-problem-report-status.dto';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { UpsertIntegrationDto } from '../../modules/platform/integrations/upsert-integration.dto';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';

@Controller('dashboard/platform')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardPlatformController {
  constructor(
    private readonly createProblemReport: CreateProblemReportHandler,
    private readonly listProblemReports: ListProblemReportsHandler,
    private readonly updateProblemReportStatus: UpdateProblemReportStatusHandler,
    private readonly upsertIntegration: UpsertIntegrationHandler,
    private readonly listIntegrations: ListIntegrationsHandler,
  ) {}

  // ── Problem Reports ──────────────────────────────────────────────────────────

  @Post('problem-reports')
  @HttpCode(HttpStatus.CREATED)
  createProblemReportEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateProblemReportDto,
  ) {
    return this.createProblemReport.execute({ tenantId, ...body });
  }

  @Get('problem-reports')
  listProblemReportsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListProblemReportsDto,
  ) {
    return this.listProblemReports.execute({ tenantId, ...query });
  }

  @Patch('problem-reports/:id/status')
  updateProblemReportStatusEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProblemReportStatusDto,
  ) {
    return this.updateProblemReportStatus.execute({ id, tenantId, ...body });
  }

  // ── Integrations ─────────────────────────────────────────────────────────────

  @Post('integrations')
  @HttpCode(HttpStatus.OK)
  upsertIntegrationEndpoint(
    @TenantId() tenantId: string,
    @Body() body: UpsertIntegrationDto,
  ) {
    return this.upsertIntegration.execute({ tenantId, ...body });
  }

  @Get('integrations')
  listIntegrationsEndpoint(@TenantId() tenantId: string) {
    return this.listIntegrations.execute(tenantId);
  }
}
