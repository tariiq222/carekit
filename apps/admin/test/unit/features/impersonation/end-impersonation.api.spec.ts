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

describe('end-impersonation.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with POST and correct URL containing sessionId', async () => {
    const { endImpersonation } = await import('@/features/impersonation/end-impersonation/end-impersonation.api');
    mockApiRequest.mockResolvedValue(undefined);

    await endImpersonation('session-abc-123');

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/impersonation/session-abc-123/end', { method: 'POST' });
  });

  it('returns void', async () => {
    const { endImpersonation } = await import('@/features/impersonation/end-impersonation/end-impersonation.api');
    mockApiRequest.mockResolvedValue(undefined);

    const result = await endImpersonation('sess-1');

    expect(result).toBeUndefined();
  });
});
