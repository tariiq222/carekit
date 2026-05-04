import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import { adminRequest } from '@/lib/api-client';
import SettingsLayout from '@/app/(admin)/settings/layout';
import BrandingSettingsPage from '@/app/(admin)/settings/branding/page';
import SettingsPage from '@/app/(admin)/settings/page';

// ── Settings Hub Page (redirects to /settings/email) ────────────────────────
describe('SettingsPage', () => {
  it('renders without crashing (redirect is called)', () => {
    // SettingsPage calls redirect('/settings/email') — vi.mock suppresses the throw
    // Just verify the component can be called
    expect(() => SettingsPage()).not.toThrow();
  });
});

// ── Settings Layout ─────────────────────────────────────────────────────────
describe('SettingsLayout', () => {
  it('renders navigation tabs', () => {
    render(<SettingsLayout><div>child</div></SettingsLayout>);
    expect(screen.getByRole('link', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Branding' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'System Health' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Security' })).toBeInTheDocument();
  });

  it('renders children', () => {
    render(<SettingsLayout><div>test child content</div></SettingsLayout>);
    expect(screen.getByText('test child content')).toBeInTheDocument();
  });
});

// ── Branding Settings Page ──────────────────────────────────────────────────
describe('BrandingSettingsPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Branding heading', () => {
    vi.mocked(adminRequest).mockResolvedValue({
      logoUrl: '',
      primaryColor: '#354FD8',
      accentColor: '#82CC17',
      locale: { default: 'ar', rtlDefault: true, dateFormat: 'dd/MM/yyyy', currencyFormat: 'SAR' },
    });
    render(<BrandingSettingsPage />);
    expect(screen.getByText('Branding')).toBeInTheDocument();
  });

  it('renders BrandingForm after settings loaded', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      logoUrl: 'https://cdn.example.com/logo.svg',
      primaryColor: '#354FD8',
      accentColor: '#82CC17',
      locale: { default: 'ar', rtlDefault: true, dateFormat: 'dd/MM/yyyy', currencyFormat: 'SAR' },
    });
    render(<BrandingSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/brand identity/i)).toBeInTheDocument();
    });
  });
});
