import { describe, expect, it, vi } from 'vitest';
import { useGetPlatformMetrics, platformMetricsKey } from '@/features/platform-metrics/get-platform-metrics/use-get-platform-metrics';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useGetPlatformMetrics', () => {
  it('exports correct platformMetricsKey', () => {
    const key = platformMetricsKey;

    expect(key).toEqual(['platform-metrics']);
  });
});
