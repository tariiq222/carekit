import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { MetricsAuthGuard } from './metrics-auth.guard.js';
import { MetricsService } from './metrics.service.js';

/**
 * Prometheus metrics endpoint.
 *
 * Protected at the application level via MetricsAuthGuard:
 *   Authorization: Bearer <METRICS_TOKEN>
 *
 * Set METRICS_TOKEN in environment. Without it the endpoint returns 401.
 * For additional hardening, restrict this path to internal IPs in Nginx.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  @UseGuards(MetricsAuthGuard)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metrics.getMetrics();
  }
}
