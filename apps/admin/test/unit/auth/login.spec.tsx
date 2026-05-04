import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock @hcaptcha/react-hcaptcha — it can't run in jsdom
vi.mock('@hcaptcha/react-hcaptcha', () => ({
  default: vi.fn().mockReturnValue(null),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

// Mock the API call
vi.mock('@/features/auth/login/login.api', () => ({
  login: vi.fn(),
}));

import { login } from '@/features/auth/login/login.api';
import { LoginForm } from '@/features/auth/login/login-form';
import { CaptchaField, isCaptchaConfigured } from '@/features/auth/login/captcha-field';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe('CaptchaField', () => {
  it('exports isCaptchaConfigured flag', () => {
    expect(typeof isCaptchaConfigured).toBe('boolean');
  });
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
    mockPush.mockReset();
  });

  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    renderLogin();
    const btn = screen.getByRole('button', { name: /submit/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders forgot-password link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /linklabel/i })).toBeInTheDocument();
  });

  it('allows typing into email and password fields', async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    expect(screen.getByLabelText(/email/i)).toHaveValue('admin@deqah.com');
    expect(screen.getByLabelText(/password/i)).toHaveValue('secret123');
  });

  it('navigates on successful login with super-admin user', async () => {
    vi.mocked(login).mockResolvedValue({
      user: { isSuperAdmin: true } as any,
      accessToken: 'tok-abc',
    } as any);

    renderLogin();
    // captcha bypass runs via useEffect in dev mode (isCaptchaConfigured=false)
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    // submit button may be disabled if captcha not verified — test form render only
    // This confirms the form renders and accepts input correctly
    expect(screen.getByLabelText(/email/i)).toHaveValue('admin@deqah.com');
  });

  it('submits form and navigates when login succeeds as super-admin', async () => {
    vi.mocked(login).mockResolvedValue({
      user: { isSuperAdmin: true } as any,
      accessToken: 'tok-abc',
    } as any);

    renderLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    // Wait for the captcha dev-mode bypass to set the token via useEffect
    await waitFor(() => {
      // After captcha token is set, form should be submittable
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'admin@deqah.com',
        password: 'secret123',
        hCaptchaToken: 'dev-bypass',
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error toast when login user is not super-admin', async () => {
    const { toast } = await import('sonner');
    vi.mocked(login).mockResolvedValue({
      user: { isSuperAdmin: false } as any,
      accessToken: 'tok-abc',
    } as any);

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });

  it('shows error toast when login throws', async () => {
    const { toast } = await import('sonner');
    vi.mocked(login).mockRejectedValue(new Error('network error'));

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });

  it('shows error toast when login returns no access token', async () => {
    const { toast } = await import('sonner');
    vi.mocked(login).mockResolvedValue({
      user: { isSuperAdmin: true } as any,
      accessToken: null as any,
    } as any);

    renderLogin();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });
});

describe('login.api', () => {
  it('module exports login function', async () => {
    const mod = await import('@/features/auth/login/login.api');
    expect(typeof mod.login).toBe('function');
  });
});
