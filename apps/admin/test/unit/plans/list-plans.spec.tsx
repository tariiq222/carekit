import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { useListPlans } from '@/features/plans/list-plans/use-list-plans';
import { PlansTable } from '@/features/plans/list-plans/plans-table';
import type { PlanRow } from '@/features/plans/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    createElement('a', { href, ...props }, children),
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

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

const INACTIVE_PLAN: PlanRow = {
  ...MOCK_PLAN,
  id: 'plan-002',
  slug: 'legacy',
  nameAr: 'قديم',
  nameEn: 'Legacy',
  isActive: false,
};

const PLAN_WITH_SUBS: PlanRow = {
  ...MOCK_PLAN,
  id: 'plan-003',
  slug: 'pro',
  nameAr: 'متقدم',
  nameEn: 'Pro',
  priceMonthly: 299,
  priceAnnual: 2999,
  _count: { subscriptions: 5 },
};

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useListPlans', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches from /plans endpoint', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue([MOCK_PLAN]);

    const { result } = renderHook(() => useListPlans(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/plans');
  });

  it('returns plan data on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue([MOCK_PLAN, INACTIVE_PLAN]);

    const { result } = renderHook(() => useListPlans(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].slug).toBe('basic');
  });

  it('uses correct query key', async () => {
    const { wrapper, queryClient } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue([]);

    const { result } = renderHook(() => useListPlans(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({ queryKey: ['plans', 'list'] });
    expect(query).toBeDefined();
  });

  it('enters error state on API failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('network_error'));

    const { result } = renderHook(() => useListPlans(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── PlansTable tests ─────────────────────────────────────────────────────────

describe('PlansTable', () => {
  const onDelete = vi.fn();

  beforeEach(() => {
    onDelete.mockReset();
  });

  function renderTable(items: PlanRow[] | undefined, isLoading = false) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PlansTable items={items} isLoading={isLoading} onDelete={onDelete} />
      </QueryClientProvider>,
    );
  }

  it('renders skeleton rows while loading', () => {
    renderTable(undefined, true);
    // Skeletons render as divs with class h-6
    const skeletons = document.querySelectorAll('[class*="h-6"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders plan slug and names', () => {
    renderTable([MOCK_PLAN]);
    expect(screen.getByText('basic')).toBeInTheDocument();
    expect(screen.getByText('أساسي')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('renders Active badge for active plan', () => {
    renderTable([MOCK_PLAN]);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders Inactive badge for inactive plan', () => {
    renderTable([INACTIVE_PLAN]);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows price and currency', () => {
    renderTable([MOCK_PLAN]);
    // priceMonthly=99 and priceAnnual=999 shown in cells with currency SAR
    const sarCells = screen.getAllByText(/SAR/);
    expect(sarCells.length).toBeGreaterThan(0);
  });

  it('shows subscriber count badge when subscriptions > 0', () => {
    renderTable([PLAN_WITH_SUBS]);
    // Badge with count 5 shown
    expect(screen.getByTitle(/5 active subscriber/i)).toBeInTheDocument();
  });

  it('shows em-dash for subscriber count when 0 subscribers', () => {
    renderTable([MOCK_PLAN]);
    // The subscriber count cell shows — for 0
    const cells = screen.getAllByRole('cell');
    const subCell = cells.find((c) => c.textContent === '—');
    expect(subCell).toBeDefined();
  });

  it('renders Edit link pointing to /plans/:id/edit', () => {
    renderTable([MOCK_PLAN]);
    const editLink = screen.getByRole('link', { name: /edit/i });
    expect(editLink).toHaveAttribute('href', '/plans/plan-001/edit');
  });

  it('calls onDelete when Delete button is clicked', async () => {
    renderTable([MOCK_PLAN]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(MOCK_PLAN);
  });

  it('shows empty state when items is empty array and not loading', () => {
    renderTable([]);
    expect(screen.getByText(/no plans defined/i)).toBeInTheDocument();
  });

  it('renders multiple plans', () => {
    renderTable([MOCK_PLAN, INACTIVE_PLAN, PLAN_WITH_SUBS]);
    expect(screen.getByText('basic')).toBeInTheDocument();
    expect(screen.getByText('legacy')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('does not show empty state when isLoading', () => {
    renderTable(undefined, true);
    expect(screen.queryByText(/no plans defined/i)).not.toBeInTheDocument();
  });
});
