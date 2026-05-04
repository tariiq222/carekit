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

describe('get-organization.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with correct URL path', async () => {
    const { getOrganization } = await import('@/features/organizations/get-organization/get-organization.api');
    mockApiRequest.mockResolvedValue({ id: 'org-42', nameEn: 'Test Clinic' });

    await getOrganization('org-42');

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/organizations/org-42', {});
  });

  it('uses GET method (default)', async () => {
    const { getOrganization } = await import('@/features/organizations/get-organization/get-organization.api');
    mockApiRequest.mockResolvedValue({ id: '1' });

    await getOrganization('1');

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit?];
    expect(call[1]).toEqual({});
  });

  it('returns typed OrganizationDetail', async () => {
    const { getOrganization } = await import('@/features/organizations/get-organization/get-organization.api');
    const mockDetail = { id: 'org-1', nameAr: 'عيادة', nameEn: 'Clinic', status: 'ACTIVE' as const };
    mockApiRequest.mockResolvedValue(mockDetail);

    const result = await getOrganization('org-1');

    expect(result.nameEn).toBe('Clinic');
  });
});
