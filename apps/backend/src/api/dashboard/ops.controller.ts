import {
  Controller, Get, Post, Body, Query,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportFormat, ReportType, ActivityAction } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { GenerateReportHandler } from '../../modules/ops/generate-report/generate-report.handler';
import { ListActivityHandler } from '../../modules/ops/log-activity/list-activity.handler';

// ── Report DTOs ───────────────────────────────────────────────────────────────

export class GenerateReportBody {
  @IsEnum(ReportType) type!: ReportType;
  @IsOptional() @IsEnum(ReportFormat) format?: ReportFormat;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() requestedBy?: string;
}

// ── Activity DTOs ─────────────────────────────────────────────────────────────

export class ListActivityQuery {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() entity?: string;
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsEnum(ActivityAction) action?: ActivityAction;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('dashboard/ops')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardOpsController {
  constructor(
    private readonly generateReport: GenerateReportHandler,
    private readonly listActivity: ListActivityHandler,
  ) {}

  @Post('reports')
  @HttpCode(HttpStatus.OK)
  async generateReportEndpoint(
    @TenantId() tenantId: string,
    @Body() body: GenerateReportBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.generateReport.execute({ tenantId, ...body });

    if (result.format === ReportFormat.EXCEL && result.excelBuffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${result.reportId}.xlsx"`);
      res.send(result.excelBuffer);
      return;
    }

    return result;
  }

  @Get('activity')
  listActivityEndpoint(@TenantId() tenantId: string, @Query() query: ListActivityQuery) {
    return this.listActivity.execute({
      tenantId,
      userId: query.userId,
      entity: query.entity,
      entityId: query.entityId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }
}
