import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import OverviewPage from '@/app/(admin)/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><OverviewPage /></QueryClientProvider>);
}

describe('OverviewPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders the Overview heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 },
      users: { total: 0 }, bookings: { totalLast30Days: 0 },
      revenue: { lifetimePaidSar: '0' }, subscriptions: { byPlan: {}, byStatus: {} },
    });
    renderPage();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders platform snapshot description', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 },
      users: { total: 0 }, bookings: { totalLast30Days: 0 },
      revenue: { lifetimePaidSar: '0' }, subscriptions: { byPlan: {}, byStatus: {} },
    });
    renderPage();
    expect(screen.getByText(/platform-wide snapshot/i)).toBeInTheDocument();
  });

  it('renders MetricsGrid', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      organizations: { total: 5, active: 4, suspended: 1, newThisMonth: 1 },
      users: { total: 100 }, bookings: { totalLast30Days: 50 },
      revenue: { lifetimePaidSar: '1000' }, subscriptions: { byPlan: {}, byStatus: {} },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
  });
});
