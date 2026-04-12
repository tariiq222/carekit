import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  IsEnum, IsInt, IsOptional, IsString, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemReportStatus, ProblemReportType } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';

// ── Problem Report DTOs ───────────────────────────────────────────────────────

export class CreateProblemReportBody {
  @IsString() reporterId!: string;
  @IsEnum(ProblemReportType) type!: ProblemReportType;
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
}

export class ListProblemReportsQuery {
  @IsOptional() @IsEnum(ProblemReportStatus) status?: ProblemReportStatus;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class UpdateProblemReportStatusBody {
  @IsEnum(ProblemReportStatus) status!: ProblemReportStatus;
  @IsOptional() @IsString() resolution?: string;
}

// ── Integration DTOs ──────────────────────────────────────────────────────────

export class UpsertIntegrationBody {
  @IsString() provider!: string;
  config!: Record<string, unknown>;
  @IsOptional() isActive?: boolean;
}

// ── Controller ────────────────────────────────────────────────────────────────

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

  // ── Problem Reports ────────────────────────────────────────────────────────

  @Post('problem-reports')
  @HttpCode(HttpStatus.CREATED)
  createProblemReportEndpoint(
    @TenantId() tenantId: string,
    @Body() body: CreateProblemReportBody,
  ) {
    return this.createProblemReport.execute({ tenantId, ...body });
  }

  @Get('problem-reports')
  listProblemReportsEndpoint(
    @TenantId() tenantId: string,
    @Query() query: ListProblemReportsQuery,
  ) {
    return this.listProblemReports.execute({
      tenantId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Patch('problem-reports/:id/status')
  updateProblemReportStatusEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProblemReportStatusBody,
  ) {
    return this.updateProblemReportStatus.execute({
      id,
      tenantId,
      status: body.status,
      resolution: body.resolution,
    });
  }

  // ── Integrations ───────────────────────────────────────────────────────────

  @Post('integrations')
  @HttpCode(HttpStatus.OK)
  upsertIntegrationEndpoint(
    @TenantId() tenantId: string,
    @Body() body: UpsertIntegrationBody,
  ) {
    return this.upsertIntegration.execute({
      tenantId,
      provider: body.provider,
      config: body.config,
      isActive: body.isActive,
    });
  }

  @Get('integrations')
  listIntegrationsEndpoint(@TenantId() tenantId: string) {
    return this.listIntegrations.execute(tenantId);
  }
}
