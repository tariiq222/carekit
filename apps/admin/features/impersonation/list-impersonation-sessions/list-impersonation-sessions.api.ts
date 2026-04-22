import { adminRequest } from '@/lib/api-client';
import type { PageMeta } from '@/lib/types';
import type { ImpersonationSession } from '../types';

export interface ListImpersonationSessionsParams {
  page: number;
  perPage: number;
  active?: 'true' | 'false';
}

export interface ListImpersonationSessionsResponse {
  items: ImpersonationSession[];
  meta: PageMeta;
}

export function listImpersonationSessions(
  p: ListImpersonationSessionsParams,
): Promise<ListImpersonationSessionsResponse> {
  const search = new URLSearchParams({ page: String(p.page), perPage: String(p.perPage) });
  if (p.active) search.set('active', p.active);
  return adminRequest<ListImpersonationSessionsResponse>(
    `/impersonation/sessions?${search.toString()}`,
  );
}
