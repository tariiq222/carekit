import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { PlanFormTabs } from '@/features/plans/plan-form-tabs';
import type { PlanRow } from '@/features/plans/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MOCK_PLAN: PlanRow = {
  id: 'plan-001',
  slug: 'basic',
  nameAr: 'أساسي',
  nameEn: 'Basic',
  priceMonthly: 99,
  priceAnnual: 999,
  currency: 'SAR',
  isActive: true,
  isVisible: true,
  sortOrder: 1,
  limits: {},
  createdAt: '2026-01-01T00:00:00Z',
  _count: { subscriptions: 0 },
};

function renderTabs(activeTab = 'general', overrides?: { onActiveTabChange?: ReturnType<typeof vi.fn> }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onActiveTabChange = overrides?.onActiveTabChange ?? vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <PlanFormTabs
        general={<div data-testid="general-slot">General content here</div>}
        activeTab={activeTab}
        onActiveTabChange={onActiveTabChange}
      />
    </QueryClientProvider>,
  );
  return { onActiveTabChange };
}

describe('PlanFormTabs', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders General and Compare & Edit Plans tabs', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /compare.*edit.*plans/i })).toBeInTheDocument();
  });

  it('shows general slot content when activeTab is general', () => {
    renderTabs('general');
    expect(screen.getByTestId('general-slot')).toBeInTheDocument();
  });

  it('shows loading skeleton when all-plans tab is active and data is loading', () => {
    // adminRequest not resolved yet → loading state
    vi.mocked(adminRequest).mockImplementation(() => new Promise(() => {}));
    renderTabs('all-plans');
    // Should render a pulse skeleton div
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });

  it('shows ComparePlansMatrix when all-plans tab is active and data is loaded', async () => {
    vi.mocked(adminRequest).mockResolvedValue([MOCK_PLAN]);
    renderTabs('all-plans');
    await waitFor(() => {
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });
  });

  it('passes empty array to ComparePlansMatrix when plans data is undefined', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    renderTabs('all-plans');
    await waitFor(() => {
      // ComparePlansMatrix renders even with empty plans
      expect(screen.getByText('Feature')).toBeInTheDocument();
    });
  });

  it('calls onActiveTabChange when tab is clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    const { onActiveTabChange } = renderTabs('general');
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /compare.*edit.*plans/i }));
    expect(onActiveTabChange).toHaveBeenCalledWith('all-plans');
  });

  it('calls onActiveTabChange with "general" when General tab is clicked from all-plans', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    const { onActiveTabChange } = renderTabs('all-plans');
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^general$/i }));
    expect(onActiveTabChange).toHaveBeenCalledWith('general');
  });
});
