import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = new Registry();

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;

  // DB row counts — updated by CleanupService.logTableGrowthSnapshot() weekly
  readonly dbTableRows: Gauge;

  // BullMQ jobs that exhausted all retries — incremented by QueueFailureService
  readonly jobFailuresTotal: Counter;

  // Prisma queries exceeding 500ms — incremented by PrismaService middleware
  readonly slowQueriesTotal: Counter;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.dbTableRows = new Gauge({
      name: 'db_table_rows_total',
      help: 'Approximate row count per table (updated by weekly snapshot job)',
      labelNames: ['table'] as const,
      registers: [this.registry],
    });

    this.jobFailuresTotal = new Counter({
      name: 'job_failures_total',
      help: 'Number of BullMQ jobs that exhausted all retries',
      labelNames: ['queue', 'job_name'] as const,
      registers: [this.registry],
    });

    this.slowQueriesTotal = new Counter({
      name: 'db_slow_queries_total',
      help: 'Number of Prisma queries exceeding 500ms',
      labelNames: ['model', 'action'] as const,
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
