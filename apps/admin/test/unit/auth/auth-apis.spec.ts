/**
 * Tests for auth API function modules (login.api, forgot-password.api, reset-password.api).
 * These tests import the real modules (not mocked) to ensure coverage.
 * @deqah/api-client is mocked so no real HTTP calls are made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@deqah/api-client', () => ({
  initClient: vi.fn(),
  apiRequest: vi.fn(),
  authApi: {
    login: vi.fn(),
    requestStaffPasswordReset: vi.fn(),
    performStaffPasswordReset: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  },
}));

// Also mock the local api-client to avoid initClient side effects
vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn(), publicRequest: vi.fn() }));

describe('login.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('login() calls authApi.login with body', async () => {
    const { authApi } = await import('@deqah/api-client');
    vi.mocked(authApi.login).mockResolvedValue({ accessToken: 'tok', refreshToken: 'ref' } as any);
    const { login } = await import('@/features/auth/login/login.api');
    const result = await login({ email: 'a@b.com', password: 'pass' });
    expect(authApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
    expect(result).toMatchObject({ accessToken: 'tok' });
  });
});

describe('forgot-password.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requestPasswordReset() calls authApi.requestStaffPasswordReset with email', async () => {
    const { authApi } = await import('@deqah/api-client');
    vi.mocked(authApi.requestStaffPasswordReset).mockResolvedValue(undefined as any);
    const { requestPasswordReset } = await import('@/features/auth/forgot-password/forgot-password.api');
    await requestPasswordReset('test@example.com');
    expect(authApi.requestStaffPasswordReset).toHaveBeenCalledWith('test@example.com');
  });
});

describe('reset-password.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resetPassword() calls authApi.performStaffPasswordReset with token and password', async () => {
    const { authApi } = await import('@deqah/api-client');
    vi.mocked(authApi.performStaffPasswordReset).mockResolvedValue(undefined as any);
    const { resetPassword } = await import('@/features/auth/reset-password/reset-password.api');
    await resetPassword('reset-token-123', 'newpass');
    expect(authApi.performStaffPasswordReset).toHaveBeenCalledWith('reset-token-123', 'newpass');
  });
});
