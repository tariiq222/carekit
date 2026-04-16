import {
  Controller, Get, Post, Body, Query,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportFormat } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { GenerateReportHandler } from '../../modules/ops/generate-report/generate-report.handler';
import { GenerateReportDto } from '../../modules/ops/generate-report/generate-report.dto';
import { ListActivityHandler } from '../../modules/ops/log-activity/list-activity.handler';
import { ListActivityDto } from '../../modules/ops/log-activity/list-activity.dto';

@ApiTags('Ops')
@ApiBearerAuth()
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
    @Body() body: GenerateReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.generateReport.execute(body);

    if (result.format === ReportFormat.EXCEL && result.excelBuffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${result.reportId}.xlsx"`);
      res.send(result.excelBuffer);
      return;
    }

    return result;
  }

  @Get('activity')
  listActivityEndpoint(@Query() query: ListActivityDto) {
    return this.listActivity.execute(query);
  }
}
