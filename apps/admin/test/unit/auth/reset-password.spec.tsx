import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Control the token param
let mockToken: string | null = 'valid-reset-token';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => ({ get: (key: string) => (key === 'token' ? mockToken : null) }),
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

vi.mock('@/features/auth/reset-password/reset-password.api', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '@/features/auth/reset-password/reset-password.api';
import { ResetPasswordForm } from '@/features/auth/reset-password/reset-password-form';

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><ResetPasswordForm /></QueryClientProvider>);
}

describe('ResetPasswordForm — no token', () => {
  beforeEach(() => {
    mockToken = null;
  });

  it('shows invalid token message when no token in URL', () => {
    renderForm();
    expect(screen.getByText(/invalidtoken/i)).toBeInTheDocument();
  });

  it('shows a back to login link', () => {
    renderForm();
    expect(screen.getByRole('link', { name: /backtologin/i })).toBeInTheDocument();
  });
});

describe('ResetPasswordForm — with valid token', () => {
  beforeEach(() => {
    mockToken = 'valid-reset-token';
    vi.mocked(resetPassword).mockReset();
  });

  it('renders new password and confirm password fields', () => {
    renderForm();
    expect(screen.getByLabelText(/newpassword/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmpassword/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows error when password is too short (< 8 chars)', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/newpassword/i), 'short');
    await user.type(screen.getByLabelText(/confirmpassword/i), 'short');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/weakpassword/i)).toBeInTheDocument();
    });
  });

  it('shows error when passwords do not match', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/newpassword/i), 'password123');
    await user.type(screen.getByLabelText(/confirmpassword/i), 'password456');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/passwordmismatch/i)).toBeInTheDocument();
    });
  });

  it('shows success state after valid submission', async () => {
    vi.mocked(resetPassword).mockResolvedValue(undefined);
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/newpassword/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirmpassword/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith('valid-reset-token', 'newpassword123');
    });
    await waitFor(() => {
      expect(screen.getByText(/successtitle/i)).toBeInTheDocument();
    });
  });

  it('shows invalidToken error on API failure', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new Error('Token expired'));
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/newpassword/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirmpassword/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalidtoken/i)).toBeInTheDocument();
    });
  });
});

describe('reset-password.api', () => {
  it('module exports resetPassword function', async () => {
    const mod = await import('@/features/auth/reset-password/reset-password.api');
    expect(typeof mod.resetPassword).toBe('function');
  });
});
