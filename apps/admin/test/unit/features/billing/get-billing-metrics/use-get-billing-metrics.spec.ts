import { describe, expect, it, vi } from 'vitest';
import { useGetBillingMetrics, billingMetricsKey } from '@/features/billing/get-billing-metrics/use-get-billing-metrics';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: undefined,
    isLoading: true,
    error: null,
  })),
}));

describe('useGetBillingMetrics', () => {
  it('exports correct billingMetricsKey', () => {
    const key = billingMetricsKey;

    expect(key).toEqual(['billing', 'metrics']);
  });
});
