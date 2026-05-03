import { adminRequest } from '@/lib/api-client';
import type { OrganizationRow } from '../types';

export interface CreateTenantCommand {
  slug: string;
  nameAr: string;
  nameEn?: string;
  // exactly one of the two owner groups must be present
  ownerUserId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerPassword?: string;
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
