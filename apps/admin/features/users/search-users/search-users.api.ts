import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { UserRow } from '../types';

export interface SearchUsersParams {
  page: number;
  perPage: number;
  search?: string;
  organizationId?: string;
}

export interface SearchUsersResponse {
  items: UserRow[];
  meta: PageMeta;
}

export function searchUsers(p: SearchUsersParams): Promise<SearchUsersResponse> {
  const q = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.search?.trim()) q.set('search', p.search.trim());
  if (p.organizationId?.trim()) q.set('organizationId', p.organizationId.trim());
  return adminRequest<SearchUsersResponse>(`/users?${q.toString()}`);
}
