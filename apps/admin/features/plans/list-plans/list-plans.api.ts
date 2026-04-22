import { adminRequest } from '@/lib/api-client';
import type { PlanRow } from '../types';

export function listPlans(): Promise<PlanRow[]> {
  return adminRequest<PlanRow[]>('/plans');
}
