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

describe('login.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls authApi.login with correct body', async () => {
    const { login, LoginResponse } = await import('@/features/auth/login/login.api');
    const mockResponse: LoginResponse = { accessToken: 'tok', refreshToken: 'ref', user: { id: '1', email: 'a@b.com' } };
    mockAuthApi.login.mockResolvedValue(mockResponse);

    const result = await login({ email: 'a@b.com', password: 'secret', captchaToken: 'cap' });

    expect(mockAuthApi.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret', captchaToken: 'cap' });
    expect(result).toEqual(mockResponse);
  });

  it('returns typed LoginResponse', async () => {
    const { login } = await import('@/features/auth/login/login.api');
    const mockResponse = { accessToken: 'tok', refreshToken: 'ref', user: { id: '2', email: 'x@y.com' } };
    mockAuthApi.login.mockResolvedValue(mockResponse);

    const result = await login({ email: 'x@y.com', password: 'pass', captchaToken: '' });

    expect(result.accessToken).toBe('tok');
  });
});
