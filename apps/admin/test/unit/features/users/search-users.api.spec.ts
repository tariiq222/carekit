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

describe('search-users.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs correct URL with page and perPage params', async () => {
    const { searchUsers } = await import('@/features/users/search-users/search-users.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await searchUsers({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users?page=1&perPage=20', {});
  });

  it('adds optional search and organizationId params when provided', async () => {
    const { searchUsers } = await import('@/features/users/search-users/search-users.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 2, perPage: 10, total: 0 } });

    await searchUsers({ page: 2, perPage: 10, search: 'john', organizationId: 'org-5' });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users?page=2&perPage=10&search=john&organizationId=org-5', {});
  });

  it('omits empty optional params', async () => {
    const { searchUsers } = await import('@/features/users/search-users/search-users.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await searchUsers({ page: 1, perPage: 20 });

    const call = mockApiRequest.mock.calls[0] as [string, unknown];
    expect(call[0]).not.toContain('search');
    expect(call[0]).not.toContain('organizationId');
  });

  it('returns typed SearchUsersResponse', async () => {
    const { searchUsers } = await import('@/features/users/search-users/search-users.api');
    const mockResponse = { items: [{ id: 'u-1', email: 'john@clinic.com' }], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await searchUsers({ page: 1, perPage: 20 });

    expect(result.items[0].email).toBe('john@clinic.com');
  });
});
