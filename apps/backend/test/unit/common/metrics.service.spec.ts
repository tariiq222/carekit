/**
 * MetricsService Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../../../src/common/metrics/metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should expose httpRequestsTotal counter', () => {
    expect(service.httpRequestsTotal).toBeDefined();
  });

  it('should expose httpRequestDuration histogram', () => {
    expect(service.httpRequestDuration).toBeDefined();
  });

  it('should expose dbTableRows gauge', () => {
    expect(service.dbTableRows).toBeDefined();
  });

  it('should expose jobFailuresTotal counter', () => {
    expect(service.jobFailuresTotal).toBeDefined();
  });

  it('should expose slowQueriesTotal counter', () => {
    expect(service.slowQueriesTotal).toBeDefined();
  });

  it('should return metrics string from getMetrics', async () => {
    const result = await service.getMetrics();
    expect(typeof result).toBe('string');
  });

  it('should return content type string from getContentType', () => {
    const result = service.getContentType();
    expect(typeof result).toBe('string');
    expect(result).toContain('text/plain');
  });
});
