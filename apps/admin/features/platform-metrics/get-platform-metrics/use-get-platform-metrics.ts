import { useQuery } from '@tanstack/react-query';
import { getPlatformMetrics } from './get-platform-metrics.api';

export const platformMetricsKey = ['platform-metrics'] as const;

export function useGetPlatformMetrics() {
  return useQuery({
    queryKey: platformMetricsKey,
    queryFn: getPlatformMetrics,
  });
}
