import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import MetricsPage from '@/app/(admin)/metrics/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><MetricsPage /></QueryClientProvider>);
}

describe('MetricsPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders the Platform Metrics heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 },
      users: { total: 0 }, bookings: { totalLast30Days: 0 },
      revenue: { lifetimePaidSar: '0' }, subscriptions: { byPlan: {}, byStatus: {} },
    });
    renderPage();
    expect(screen.getByText(/platform metrics/i)).toBeInTheDocument();
  });

  it('renders description text', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0, newThisMonth: 0 },
      users: { total: 0 }, bookings: { totalLast30Days: 0 },
      revenue: { lifetimePaidSar: '0' }, subscriptions: { byPlan: {}, byStatus: {} },
    });
    renderPage();
    expect(screen.getByText(/cross-tenant snapshot/i)).toBeInTheDocument();
  });

  it('renders MetricsGrid with loaded data', async () => {
    const mockMetrics = {
      organizations: { total: 10, active: 9, suspended: 0, newThisMonth: 2 },
      users: { total: 200 },
      bookings: { totalLast30Days: 500 },
      revenue: { lifetimePaidSar: '5000' },
      subscriptions: { byPlan: {}, byStatus: {} },
    };
    vi.mocked(adminRequest).mockResolvedValue(mockMetrics);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
});
