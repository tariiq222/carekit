import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { OrganizationRow, OrganizationStatus } from '../types';

export interface ListOrganizationsParams {
  page: number;
  perPage: number;
  search?: string;
  suspended?: 'true' | 'false';
  status?: OrganizationStatus;
  verticalId?: string;
  planId?: string;
}

export interface ListOrganizationsResponse {
  items: OrganizationRow[];
  meta: PageMeta;
}

export function listOrganizations(p: ListOrganizationsParams): Promise<ListOrganizationsResponse> {
  const search = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.search?.trim()) search.set('search', p.search.trim());
  if (p.suspended) search.set('suspended', p.suspended);
  if (p.status) search.set('status', p.status);
  if (p.verticalId?.trim()) search.set('verticalId', p.verticalId.trim());
  if (p.planId?.trim()) search.set('planId', p.planId.trim());
  return adminRequest<ListOrganizationsResponse>(`/organizations?${search.toString()}`);
}
