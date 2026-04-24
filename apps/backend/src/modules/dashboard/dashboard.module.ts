import { Module } from "@nestjs/common";
import { DashboardStatsController } from "../../api/dashboard/stats.controller";
import { DatabaseModule } from "../../infrastructure/database";
import { TenantModule } from "../../common/tenant";
import { GetDashboardStatsHandler } from "./get-dashboard-stats/get-dashboard-stats.handler";

@Module({
  imports: [DatabaseModule, TenantModule],
  controllers: [DashboardStatsController],
  providers: [GetDashboardStatsHandler],
  exports: [GetDashboardStatsHandler],
})
export class DashboardModule {}
