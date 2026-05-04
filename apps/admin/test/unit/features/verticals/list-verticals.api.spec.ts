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

describe('list-verticals.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with correct URL path', async () => {
    const { listVerticals } = await import('@/features/verticals/list-verticals/list-verticals.api');
    mockApiRequest.mockResolvedValue([]);

    await listVerticals();

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/verticals', {});
  });

  it('uses GET method (default)', async () => {
    const { listVerticals } = await import('@/features/verticals/list-verticals/list-verticals.api');
    mockApiRequest.mockResolvedValue([]);

    await listVerticals();

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit?];
    expect(call[1]).toEqual({});
  });

  it('returns typed VerticalRow array', async () => {
    const { listVerticals } = await import('@/features/verticals/list-verticals/list-verticals.api');
    const mockVerticals = [{ id: '1', slug: 'medical', nameEn: 'Medical' }];
    mockApiRequest.mockResolvedValue(mockVerticals);

    const result = await listVerticals();

    expect(result[0].slug).toBe('medical');
  });
});
