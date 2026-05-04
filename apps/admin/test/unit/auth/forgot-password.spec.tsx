import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

vi.mock('@/features/auth/forgot-password/forgot-password.api', () => ({
  requestPasswordReset: vi.fn(),
}));

import { requestPasswordReset } from '@/features/auth/forgot-password/forgot-password.api';
import { ForgotPasswordForm } from '@/features/auth/forgot-password/forgot-password-form';

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><ForgotPasswordForm /></QueryClientProvider>);
}

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.mocked(requestPasswordReset).mockReset();
  });

  it('renders email field and submit button', () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('renders a back link to login', () => {
    renderForm();
    const links = screen.getAllByRole('link', { name: /back/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts email input', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    expect(screen.getByLabelText(/email/i)).toHaveValue('test@example.com');
  });

  it('shows success state after successful submission', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue(undefined);
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('admin@deqah.com');
    });

    await waitFor(() => {
      expect(screen.getByText(/successtitle/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failed submission', async () => {
    vi.mocked(requestPasswordReset).mockRejectedValue(new Error('Network error'));
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/requestfailed/i)).toBeInTheDocument();
    });
  });

  it('disables the button while submitting', async () => {
    let resolve!: () => void;
    vi.mocked(requestPasswordReset).mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'admin@deqah.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
    resolve();
  });
});

describe('forgot-password.api', () => {
  it('module exports requestPasswordReset function', async () => {
    const mod = await import('@/features/auth/forgot-password/forgot-password.api');
    expect(typeof mod.requestPasswordReset).toBe('function');
  });
});
