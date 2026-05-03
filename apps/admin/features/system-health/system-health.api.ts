import { adminRequest } from '@/lib/api-client';

export interface SubsystemHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  detail?: string;
}

export interface SystemHealthResult {
  overall: 'ok' | 'degraded' | 'down';
  subsystems: SubsystemHealth[];
  checkedAt: string;
}

export function getSystemHealth(): Promise<SystemHealthResult> {
  return adminRequest<SystemHealthResult>('/system-health');
}
