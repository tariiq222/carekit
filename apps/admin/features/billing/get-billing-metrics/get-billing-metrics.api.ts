import { adminRequest } from '@/lib/api-client';
import type { BillingMetrics } from '../types';

export function getBillingMetrics(): Promise<BillingMetrics> {
  return adminRequest<BillingMetrics>('/billing/metrics');
}
