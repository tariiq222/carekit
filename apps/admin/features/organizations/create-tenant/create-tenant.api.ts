import { adminRequest } from '@/lib/api-client';
import type { OrganizationRow } from '../types';

export interface CreateTenantCommand {
  slug: string;
  nameAr: string;
  nameEn?: string;
  ownerUserId: string;
  verticalSlug?: string;
  planId?: string;
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  trialDays?: number;
  reason: string;
}

export function createTenant(cmd: CreateTenantCommand): Promise<OrganizationRow> {
  return adminRequest<OrganizationRow>('/organizations', {
    method: 'POST',
    body: JSON.stringify(cmd),
  });
}
