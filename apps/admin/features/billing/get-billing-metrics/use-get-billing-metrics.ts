import { useQuery } from '@tanstack/react-query';
import { getBillingMetrics } from './get-billing-metrics.api';

export const billingMetricsKey = ['billing', 'metrics'] as const;

export function useGetBillingMetrics() {
  return useQuery({
    queryKey: billingMetricsKey,
    queryFn: getBillingMetrics,
  });
}
