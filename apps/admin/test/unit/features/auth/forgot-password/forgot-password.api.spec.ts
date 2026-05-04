import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthApi = vi.hoisted(() => ({
  login: vi.fn(),
  requestStaffPasswordReset: vi.fn(),
  performStaffPasswordReset: vi.fn(),
}));

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    authApi: mockAuthApi,
  };
});

describe('forgot-password.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls authApi.requestStaffPasswordReset with email', async () => {
    const { requestPasswordReset } = await import('@/features/auth/forgot-password/forgot-password.api');
    mockAuthApi.requestStaffPasswordReset.mockResolvedValue(undefined);

    await requestPasswordReset('admin@clinic.com');

    expect(mockAuthApi.requestStaffPasswordReset).toHaveBeenCalledWith('admin@clinic.com');
  });

  it('returns void', async () => {
    const { requestPasswordReset } = await import('@/features/auth/forgot-password/forgot-password.api');
    mockAuthApi.requestStaffPasswordReset.mockResolvedValue(undefined);

    const result = await requestPasswordReset('a@b.com');

    expect(result).toBeUndefined();
  });
});
