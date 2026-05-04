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

describe('reset-password.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls authApi.performStaffPasswordReset with token and newPassword', async () => {
    const { resetPassword } = await import('@/features/auth/reset-password/reset-password.api');
    mockAuthApi.performStaffPasswordReset.mockResolvedValue(undefined);

    await resetPassword('reset-token-abc', 'newSecretPass123');

    expect(mockAuthApi.performStaffPasswordReset).toHaveBeenCalledWith('reset-token-abc', 'newSecretPass123');
  });

  it('returns void', async () => {
    const { resetPassword } = await import('@/features/auth/reset-password/reset-password.api');
    mockAuthApi.performStaffPasswordReset.mockResolvedValue(undefined);

    const result = await resetPassword('tok', 'pass');

    expect(result).toBeUndefined();
  });
});
