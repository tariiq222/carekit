import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { useParams } from 'next/navigation';
import EditPlanPage from '@/app/(admin)/plans/[id]/edit/page';

vi.mock('@/features/plans/list-plans/use-list-plans', () => ({
  useListPlans: vi.fn(),
}));

vi.mock('@/features/plans/update-plan/use-update-plan', () => ({
  useUpdatePlan: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/features/plans/plan-form-tabs', () => ({
  PlanFormTabs: function MockPlanFormTabs({
    general,
    activeTab,
    onActiveTabChange,
  }: {
    general: React.ReactNode;
    activeTab: string;
    onActiveTabChange: (tab: string) => void;
  }) {
    return (
      <div data-testid="plan-form-tabs">
        <div data-testid="active-tab">{activeTab}</div>
        <button onClick={() => onActiveTabChange('general')}>General</button>
        <button onClick={() => onActiveTabChange('limits')}>Limits</button>
        <div data-testid="general-tab">{general}</div>
      </div>
    );
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({ id: 'plan-1' }),
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

describe('EditPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when loading', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<EditPlanPage />, { wrapper });
    expect(document.querySelector('[class*="h-48"]')).toBeInTheDocument();
  });

  it('renders error when plan not found', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    expect(screen.getByText(/Plan not found/i)).toBeInTheDocument();
  });

  it('renders page title and form when plan found', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    expect(screen.getByText('Edit plan')).toBeInTheDocument();
    expect(screen.getByTestId('plan-form-tabs')).toBeInTheDocument();
  });

  it('renders back link to plans', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    expect(screen.getByRole('link', { name: /← back to plans/i })).toBeInTheDocument();
  });

  it('renders form fields with plan data', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    expect(screen.getByDisplayValue('BASIC')).toBeInTheDocument();
  });

  it('renders active checkbox', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    expect(screen.getByLabelText(/Plan is active/i)).toBeInTheDocument();
  });

  it('disables submit button when form is invalid', () => {
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });
    const submitButton = screen.getByRole('button', { name: /save changes/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when form is valid', async () => {
    const user = userEvent.setup();
    const { useListPlans } = vi.mocked(require('@/features/plans/list-plans/use-list-plans'));
    (useListPlans as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockPlansData,
      isLoading: false,
    });

    render(<EditPlanPage />, { wrapper });

    await user.clear(screen.getByLabelText(/Name \(Arabic\)/i));
    await user.type(screen.getByLabelText(/Name \(Arabic\)/i), 'Updated Plan');
    await user.clear(screen.getByLabelText(/Name \(English\)/i));
    await user.type(screen.getByLabelText(/Name \(English\)/i), 'Updated Plan EN');
    await user.clear(screen.getByLabelText(/Reason \(min 10 chars\)/i));
    await user.type(screen.getByLabelText(/Reason \(min 10 chars\)/i), 'This is a valid reason for testing');

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    expect(submitButton).not.toBeDisabled();
  });
});