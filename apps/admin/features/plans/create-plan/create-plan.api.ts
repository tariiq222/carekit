import { adminRequest } from '@/lib/api-client';
import type { PlanRow } from '../types';

export interface CreatePlanCommand {
  slug: 'BASIC' | 'PRO' | 'ENTERPRISE';
  nameAr: string;
  nameEn: string;
  priceMonthly: number;
  priceAnnual: number;
  currency?: string;
  limits: Record<string, unknown>;
  isActive?: boolean;
  sortOrder?: number;
  reason: string;
}

export function createPlan(cmd: CreatePlanCommand): Promise<PlanRow> {
  return adminRequest<PlanRow>('/plans', {
    method: 'POST',
    body: JSON.stringify(cmd),
  });
}
