import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PlansPage from '@/app/(admin)/plans/page';

vi.mock('@/features/plans/list-plans/use-list-plans', () => ({
  useListPlans: vi.fn(),
}));

vi.mock('@/features/plans/list-plans/plans-table', () => ({
  PlansTable: function MockPlansTable({
    items,
    isLoading,
  }: {
    items?: unknown[];
    isLoading: boolean;
  }) {
    return (
      <div data-testid="plans-table">
        {isLoading ? 'Loading...' : `${items?.length ?? 0} plans`}
      </div>
    );
  },
}));

vi.mock('@/features/plans/delete-plan/delete-plan-dialog', () => ({
  DeletePlanDialog: function MockDeletePlanDialog({ open }: { open: boolean }) {
    return open ? <div data-testid="delete-plan-dialog">Delete Plan Dialog</div> : null;
  },
}));

const mockPlansData = [
  {
    id: 'plan-1',
    slug: 'BASIC',
    nameAr: 'الأساسية',
    nameEn: 'Basic',
    priceMonthly: 99,
    priceAnnual: 990,
    currency: 'SAR',
    isActive: true,
    isVisible: true,
    sortOrder: 1,
    limits: {},
    createdAt: '2024-01-01',
    _count: { subscriptions: 5 },
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{}}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and description', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
      error: null,
    });

    render(<PlansPage />, { wrapper });
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByText(/Subscription plans available to tenants/i)).toBeInTheDocument();
  });

  it('renders plans table', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
      error: null,
    });

    render(<PlansPage />, { wrapper });
    expect(screen.getByTestId('plans-table')).toBeInTheDocument();
  });

  it('renders error state when load fails', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(<PlansPage />, { wrapper });
    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
  });

  it('renders links to create and edit pages', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
      error: null,
    });

    render(<PlansPage />, { wrapper });
    expect(screen.getByRole('link', { name: /edit features & limits/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\+ create plan/i })).toBeInTheDocument();
  });

  it('renders delete dialog when plan selected', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
      error: null,
    });

    render(<PlansPage />, { wrapper });

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    deleteButtons[0].click();

    expect(screen.getByTestId('delete-plan-dialog')).toBeInTheDocument();
  });
});