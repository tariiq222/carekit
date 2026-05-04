import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    ApiError: actual.ApiError,
  };
});

describe('list-impersonation-sessions.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs correct URL with page and perPage params', async () => {
    const { listImpersonationSessions } = await import('@/features/impersonation/list-impersonation-sessions/list-impersonation-sessions.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listImpersonationSessions({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/impersonation/sessions?page=1&perPage=20', {});
  });

  it('adds optional active param when provided', async () => {
    const { listImpersonationSessions } = await import('@/features/impersonation/list-impersonation-sessions/list-impersonation-sessions.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listImpersonationSessions({ page: 1, perPage: 20, active: 'true' });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/impersonation/sessions?page=1&perPage=20&active=true', {});
  });

  it('returns typed ListImpersonationSessionsResponse', async () => {
    const { listImpersonationSessions } = await import('@/features/impersonation/list-impersonation-sessions/list-impersonation-sessions.api');
    const mockResponse = { items: [{ id: 'sess-1', organizationId: 'org-1' }], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await listImpersonationSessions({ page: 1, perPage: 20 });

    expect(result.items[0].id).toBe('sess-1');
  });
});
