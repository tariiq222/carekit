import { adminRequest } from '@/lib/api-client';

export interface PlatformMetrics {
  organizations: { total: number; active: number; suspended: number; newThisMonth: number };
  users: { total: number };
  bookings: { totalLast30Days: number };
  revenue: { lifetimePaidSar: number | string };
  subscriptions: {
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export function getPlatformMetrics(): Promise<PlatformMetrics> {
  return adminRequest<PlatformMetrics>('/metrics/platform');
}
