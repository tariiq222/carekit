import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AppMetricsService } from '../../infrastructure/telemetry/app-metrics.service';
import { DbMetricsService } from '../../infrastructure/telemetry/db-metrics.service';

@ApiExcludeController()
@Controller('public/metrics')
export class PublicMetricsController {
  constructor(
    private readonly appMetrics: AppMetricsService,
    private readonly dbMetrics: DbMetricsService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    const [appOut, dbOut] = await Promise.all([
      this.appMetrics.registry.metrics(),
      this.dbMetrics.registry.metrics(),
    ]);
    return `${appOut}\n${dbOut}`;
  }
}
