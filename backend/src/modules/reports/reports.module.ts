import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { RevenueQueriesService } from './revenue-queries.service.js';
import { ExportService } from './export.service.js';
import { DashboardStatsService } from './dashboard-stats.service.js';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, RevenueQueriesService, ExportService, DashboardStatsService],
  exports: [DashboardStatsService],
})
export class ReportsModule {}
