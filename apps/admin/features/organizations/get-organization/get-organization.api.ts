import { adminRequest } from '@/lib/api-client';
import type { OrganizationDetail } from '../types';

export function getOrganization(id: string): Promise<OrganizationDetail> {
  return adminRequest<OrganizationDetail>(`/organizations/${id}`);
}
