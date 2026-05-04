import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@hcaptcha/react-hcaptcha', () => ({ default: vi.fn().mockReturnValue(null) }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/features/auth/login/login.api', () => ({ login: vi.fn() }));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('renders without crashing', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><LoginPage /></QueryClientProvider>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
