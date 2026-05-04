import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/features/auth/forgot-password/forgot-password.api', () => ({ requestPasswordReset: vi.fn() }));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import ForgotPasswordPage from '@/app/forgot-password/page';

describe('ForgotPasswordPage', () => {
  it('renders the forgot password form', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><ForgotPasswordPage /></QueryClientProvider>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
