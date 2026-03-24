import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator.js';
import { MetricsService } from './metrics.service.js';

/**
 * Prometheus metrics endpoint.
 * Protected in production via Nginx: restrict /api/v1/metrics to internal IPs
 * or require METRICS_TOKEN as a Bearer header in the Nginx location block.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metrics.getMetrics();
  }
}
