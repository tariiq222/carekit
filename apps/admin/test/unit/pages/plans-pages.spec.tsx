import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'plan-1' }),
  usePathname: () => '/plans',
  useSearchParams: () => new URLSearchParams(),
}));

import { adminRequest } from '@/lib/api-client';
import PlansPage from '@/app/(admin)/plans/page';
import CreatePlanPage from '@/app/(admin)/plans/new/page';
import EditPlanPage from '@/app/(admin)/plans/[id]/edit/page';
import PlansEditPage from '@/app/(admin)/plans/edit/page';

const mockPlans = [
  {
    id: 'plan-1',
    slug: 'STARTER',
    nameAr: 'مبتدئ',
    nameEn: 'Starter',
    priceMonthly: 99,
    priceAnnual: 999,
    currency: 'SAR',
    isActive: true,
    isVisible: true,
    sortOrder: 1,
    limits: {},
    createdAt: '2026-01-01T00:00:00Z',
    _count: { subscriptions: 5 },
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ── Plans List Page ─────────────────────────────────────────────────────────
describe('PlansPage', () => {
  beforeEach(() => { vi.mocked(adminRequest).mockReset(); mockPush.mockReset(); });

  it('renders Plans heading', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PlansPage />);
    expect(screen.getByRole('heading', { name: /^plans$/i })).toBeInTheDocument();
  });

  it('renders Create Plan link', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PlansPage />);
    expect(screen.getByRole('link', { name: /create plan/i })).toBeInTheDocument();
  });

  it('shows plans after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockPlans);
    renderWithProviders(<PlansPage />);
    await waitFor(() => {
      expect(screen.getByText('STARTER')).toBeInTheDocument();
    });
  });

  it('shows error when load fails', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('load_error'));
    renderWithProviders(<PlansPage />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});

// ── Create Plan Page ────────────────────────────────────────────────────────
describe('CreatePlanPage', () => {
  beforeEach(() => { vi.mocked(adminRequest).mockReset(); mockPush.mockReset(); });

  it('renders Create plan heading', () => {
    renderWithProviders(<CreatePlanPage />);
    expect(screen.getByRole('heading', { name: /create plan/i })).toBeInTheDocument();
  });

  it('renders slug input', () => {
    renderWithProviders(<CreatePlanPage />);
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
  });

  it('Create plan button is disabled initially', () => {
    renderWithProviders(<CreatePlanPage />);
    expect(screen.getByRole('button', { name: /create plan/i })).toBeDisabled();
  });

  it('Cancel button navigates to /plans', async () => {
    renderWithProviders(<CreatePlanPage />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/plans');
  });
});

// ── Edit Plan Page ──────────────────────────────────────────────────────────
describe('EditPlanPage', () => {
  beforeEach(() => { vi.mocked(adminRequest).mockReset(); mockPush.mockReset(); });

  it('shows loading skeletons while fetching plans', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<EditPlanPage />);
    const back = screen.getByText(/back to plans/i);
    expect(back).toBeInTheDocument();
  });

  it('shows Plan not found when plan id does not match', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    renderWithProviders(<EditPlanPage />);
    await waitFor(() => {
      expect(screen.getByText(/plan not found/i)).toBeInTheDocument();
    });
  });

  it('renders edit form when plan found', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockPlans);
    renderWithProviders(<EditPlanPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit plan/i })).toBeInTheDocument();
    });
  });
});

// ── Plans Edit (compare-matrix) Page ───────────────────────────────────────
describe('PlansEditPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Edit Plans heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    renderWithProviders(<PlansEditPage />);
    expect(screen.getByRole('heading', { name: /edit plans/i })).toBeInTheDocument();
  });

  it('shows empty matrix when no plans', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    renderWithProviders(<PlansEditPage />);
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: /edit plans/i })).toBeInTheDocument();
  });
});
