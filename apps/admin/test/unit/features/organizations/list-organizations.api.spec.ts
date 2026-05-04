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

describe('list-organizations.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs correct URL with page and perPage params', async () => {
    const { listOrganizations } = await import('@/features/organizations/list-organizations/list-organizations.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listOrganizations({ page: 1, perPage: 20 });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/organizations?page=1&perPage=20', {});
  });

  it('serializes optional search, status, suspended, verticalId, planId params', async () => {
    const { listOrganizations } = await import('@/features/organizations/list-organizations/list-organizations.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 2, perPage: 10, total: 0 } });

    await listOrganizations({
      page: 2,
      perPage: 10,
      search: 'clinic',
      suspended: 'false',
      status: 'ACTIVE',
      verticalId: 'med',
      planId: 'pro',
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/admin/organizations?page=2&perPage=10&search=clinic&suspended=false&status=ACTIVE&verticalId=med&planId=pro',
      {},
    );
  });

  it('omits empty optional params from query string', async () => {
    const { listOrganizations } = await import('@/features/organizations/list-organizations/list-organizations.api');
    mockApiRequest.mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0 } });

    await listOrganizations({ page: 1, perPage: 20 });

    const call = mockApiRequest.mock.calls[0] as [string, unknown];
    expect(call[0]).not.toContain('search');
    expect(call[0]).not.toContain('suspended');
  });

  it('returns typed ListOrganizationsResponse', async () => {
    const { listOrganizations } = await import('@/features/organizations/list-organizations/list-organizations.api');
    const mockResponse = { items: [{ id: '1', nameEn: 'Clinic' }], meta: { page: 1, perPage: 20, total: 1 } };
    mockApiRequest.mockResolvedValue(mockResponse);

    const result = await listOrganizations({ page: 1, perPage: 20 });

    expect(result.items[0].id).toBe('1');
    expect(result.meta.total).toBe(1);
  });
});
