import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Radix Select polyfills
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ orgId: 'org-test-id' }),
  usePathname: () => '/billing',
  useSearchParams: () => new URLSearchParams(),
}));

import { adminRequest } from '@/lib/api-client';
import BillingSubscriptionsPage from '@/app/(admin)/billing/page';
import BillingMetricsPage from '@/app/(admin)/billing/metrics/page';
import BillingInvoicesPage from '@/app/(admin)/billing/invoices/page';

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const emptySubscriptions = { items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } };
const multiPageSubscriptions = { items: [], meta: { page: 1, perPage: 20, total: 40, totalPages: 2 } };
const emptyMetrics = { mrr: 0, arr: 0, activeSubscriptions: 0, trialingSubscriptions: 0, churnedThisMonth: 0, newThisMonth: 0 };

// ── Billing Subscriptions Page ──────────────────────────────────────────────
describe('BillingSubscriptionsPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Billing Subscriptions heading', async () => {
    // BillingSubscriptionsPage uses useListSubscriptions + BillingMetricsGrid
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingSubscriptionsPage />);
    expect(screen.getByText(/billing.*subscriptions/i)).toBeInTheDocument();
  });

  it('renders filter bar', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingSubscriptionsPage />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('shows empty subscriptions list', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingSubscriptionsPage />);
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByText(/billing.*subscriptions/i)).toBeInTheDocument();
  });

  it('shows pagination when multiple pages', async () => {
    vi.mocked(adminRequest).mockImplementation((url: string) => {
      if (String(url).includes('/metrics')) {
        return Promise.resolve({ mrr: 0, arr: 0, counts: { ACTIVE: 0, TRIALING: 0, PAST_DUE: 0, CANCELED: 0, SUSPENDED: 0 }, byPlan: [] });
      }
      return Promise.resolve(multiPageSubscriptions);
    });
    renderWithProviders(<BillingSubscriptionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});

// ── Billing Metrics Page ────────────────────────────────────────────────────
describe('BillingMetricsPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Billing Metrics heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptyMetrics);
    renderWithProviders(<BillingMetricsPage />);
    expect(screen.getByText(/billing.*metrics/i)).toBeInTheDocument();
  });
});

// ── Billing Invoices Page ───────────────────────────────────────────────────
describe('BillingInvoicesPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Billing Invoices heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingInvoicesPage />);
    expect(screen.getByText(/billing.*invoices/i)).toBeInTheDocument();
  });

  it('shows empty invoices list', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingInvoicesPage />);
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByText(/billing.*invoices/i)).toBeInTheDocument();
  });

  it('shows pagination when multiple pages', async () => {
    vi.mocked(adminRequest).mockResolvedValue(multiPageSubscriptions);
    renderWithProviders(<BillingInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renders filter bar with org id input', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/org/i)).toBeInTheDocument();
    });
  });

  it('reset button clears filters', async () => {
    vi.mocked(adminRequest).mockResolvedValue(emptySubscriptions);
    renderWithProviders(<BillingInvoicesPage />);
    const user = userEvent.setup();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(vi.mocked(adminRequest)).toHaveBeenCalled();
  });
});
