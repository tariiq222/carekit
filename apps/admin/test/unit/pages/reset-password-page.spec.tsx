import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => 'tok-abc' }),
}));

vi.mock('@/features/auth/reset-password/reset-password.api', () => ({ resetPassword: vi.fn() }));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import ResetPasswordPage from '@/app/reset-password/page';

describe('ResetPasswordPage', () => {
  it('renders the reset password form when token present', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><ResetPasswordPage /></QueryClientProvider>);
    expect(screen.getByLabelText(/newpassword/i)).toBeInTheDocument();
  });
});
