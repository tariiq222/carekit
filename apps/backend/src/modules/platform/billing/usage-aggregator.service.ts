import { Injectable } from '@nestjs/common';

type MetricMap = Map<string, number>;

@Injectable()
export class UsageAggregatorService {
  private readonly counters = new Map<string, MetricMap>();

  increment(organizationId: string, metric: string, delta: number): void {
    if (!this.counters.has(organizationId)) {
      this.counters.set(organizationId, new Map());
    }
    const metrics = this.counters.get(organizationId)!;
    metrics.set(metric, (metrics.get(metric) ?? 0) + delta);
  }

  flush(): Array<{ organizationId: string; metric: string; count: number }> {
    const result: Array<{ organizationId: string; metric: string; count: number }> = [];
    for (const [orgId, metrics] of this.counters.entries()) {
      for (const [metric, count] of metrics.entries()) {
        result.push({ organizationId: orgId, metric, count });
      }
    }
    this.counters.clear();
    return result;
  }

  getCount(organizationId: string, metric: string): number {
    return this.counters.get(organizationId)?.get(metric) ?? 0;
  }
}
