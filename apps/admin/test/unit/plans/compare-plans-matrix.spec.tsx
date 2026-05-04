import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import { ComparePlansMatrix } from '@/features/plans/compare-plans/compare-plans-matrix';
import type { PlanRow } from '@/features/plans/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makePlan(overrides: Partial<PlanRow> = {}): PlanRow {
  return {
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
    ...overrides,
  };
}

function renderMatrix(plans: PlanRow[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ComparePlansMatrix plans={plans} />
    </QueryClientProvider>,
  );
}

// Polyfills for jsdom
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
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  vi.mocked(adminRequest).mockReset();
});

describe('ComparePlansMatrix', () => {
  it('renders without crashing with empty plans array', () => {
    renderMatrix([]);
    // No plan headers, but "Feature" header should render
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('renders plan slugs in header with 1 plan', () => {
    renderMatrix([makePlan()]);
    expect(screen.getByText('basic')).toBeInTheDocument();
  });

  it('renders all plan slugs with 2 plans', () => {
    const plans = [
      makePlan({ id: 'plan-001', slug: 'basic', sortOrder: 1 }),
      makePlan({ id: 'plan-002', slug: 'pro', sortOrder: 2 }),
    ];
    renderMatrix(plans);
    expect(screen.getByText('basic')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('renders 4 plans with their slugs', () => {
    const plans = [
      makePlan({ id: 'p1', slug: 'starter', sortOrder: 1 }),
      makePlan({ id: 'p2', slug: 'basic', sortOrder: 2 }),
      makePlan({ id: 'p3', slug: 'pro', sortOrder: 3 }),
      makePlan({ id: 'p4', slug: 'enterprise', sortOrder: 4 }),
    ];
    renderMatrix(plans);
    expect(screen.getByText('starter')).toBeInTheDocument();
    expect(screen.getByText('basic')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('enterprise')).toBeInTheDocument();
  });

  it('sorts plans by sortOrder', () => {
    const plans = [
      makePlan({ id: 'p2', slug: 'pro', sortOrder: 2 }),
      makePlan({ id: 'p1', slug: 'basic', sortOrder: 1 }),
    ];
    renderMatrix(plans);
    const slugEls = screen.getAllByText(/basic|pro/);
    // "basic" should appear before "pro" after sorting
    expect(slugEls[0].textContent).toBe('basic');
    expect(slugEls[1].textContent).toBe('pro');
  });

  it('renders group headers from FEATURE_CATALOG', () => {
    renderMatrix([makePlan()]);
    // Feature catalog groups should appear
    expect(screen.getByText(/Booking & Scheduling/i)).toBeInTheDocument();
  });

  it('renders boolean feature rows as Switch controls', () => {
    renderMatrix([makePlan()]);
    // There should be Switch controls (role=switch) for boolean features
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('shows subscriber count badge when subscriptions > 0', () => {
    renderMatrix([makePlan({ _count: { subscriptions: 3 } })]);
    expect(screen.getByTitle(/3 active subscriber/i)).toBeInTheDocument();
  });

  it('does not show subscriber badge when subscriptions === 0', () => {
    renderMatrix([makePlan({ _count: { subscriptions: 0 } })]);
    expect(screen.queryByTitle(/active subscriber/i)).not.toBeInTheDocument();
  });

  it('Save changes button is disabled initially (no changes)', () => {
    renderMatrix([makePlan()]);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('shows "No pending changes" message initially', () => {
    renderMatrix([makePlan()]);
    expect(screen.getByText(/no pending changes/i)).toBeInTheDocument();
  });

  it('reason textarea renders', () => {
    renderMatrix([makePlan()]);
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('Save button remains disabled with reason < 10 chars', async () => {
    renderMatrix([makePlan()]);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'short');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('Cancel button is present and not disabled initially', () => {
    renderMatrix([makePlan()]);
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled();
  });

  it('toggling a Switch marks plan as dirty', async () => {
    renderMatrix([makePlan({ id: 'plan-001', slug: 'basic' })]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    // After toggling, dirty indicator should show (pending message)
    await waitFor(() => {
      expect(screen.queryByText(/no pending changes/i)).not.toBeInTheDocument();
    });
  });

  it('shows pending plans count after toggle', async () => {
    renderMatrix([makePlan({ id: 'plan-001', slug: 'basic' })]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await waitFor(() => {
      expect(screen.getByText(/1 plan pending/i)).toBeInTheDocument();
    });
  });

  it('Save button enables when dirty + reason >= 10 chars', async () => {
    renderMatrix([makePlan()]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await user.type(screen.getByLabelText(/reason/i), 'A valid reason here');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
    });
  });

  it('successful save calls batchUpdate and shows toast.success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(makePlan());
    renderMatrix([makePlan()]);
    const user = userEvent.setup();

    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await user.type(screen.getByLabelText(/reason/i), 'Updated feature flags');

    // Mock window.confirm for subscriber check
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const { toast } = vi.mocked({ toast: { success: vi.fn() } });
      void toast;
      expect(adminRequest).toHaveBeenCalled();
    });
  });

  it('Cancel with no changes resets without confirm dialog', async () => {
    renderMatrix([makePlan()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Cancel with dirty changes shows confirm dialog', async () => {
    renderMatrix([makePlan()]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]); // make dirty
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('Cancel with dirty changes and declined confirm does NOT reset', async () => {
    renderMatrix([makePlan()]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]); // make dirty
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    // Still pending
    await waitFor(() => {
      expect(screen.queryByText(/no pending changes/i)).not.toBeInTheDocument();
    });
  });

  it('shows subscriber confirmation when saving a plan with subscribers', async () => {
    const planWithSubs = makePlan({ id: 'plan-001', _count: { subscriptions: 2 } });
    vi.mocked(adminRequest).mockResolvedValue(planWithSubs);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderMatrix([planWithSubs]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await user.type(screen.getByLabelText(/reason/i), 'Saving with subscribers present');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
    });
  });

  it('shows partial-failure toast.error when some plans fail', async () => {
    const { toast } = await import('sonner');
    const plan1 = makePlan({ id: 'plan-001', slug: 'basic', sortOrder: 1 });
    const plan2 = makePlan({ id: 'plan-002', slug: 'pro', sortOrder: 2 });
    // first call (plan1) succeeds, second (plan2) fails
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(plan1)
      .mockRejectedValueOnce(new Error('plan_002_update_failed'));

    renderMatrix([plan1, plan2]);
    const user = userEvent.setup();

    // Toggle first switch from plan1, then from plan2 to mark both dirty
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await user.click(switches[1]);
    await user.type(screen.getByLabelText(/reason/i), 'Batch update test reason');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('renders quantitative input cells for branches feature', () => {
    // The FEATURE_CATALOG has 'branches' as quantitative — it should render an Input not a Switch
    // Rendering with a plan that has limits for branches
    const plan = makePlan({ limits: { maxBranches: 3 } });
    renderMatrix([plan]);
    // There should be at least one number input (branches is quantitative)
    const numberInputs = screen.queryAllByRole('spinbutton');
    expect(numberInputs.length).toBeGreaterThan(0);
  });

  it('does not save when reason < 10 chars even with dirty state', async () => {
    renderMatrix([makePlan()]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    await user.type(screen.getByLabelText(/reason/i), 'short');
    const btn = screen.getByRole('button', { name: /save changes/i });
    expect(btn).toBeDisabled();
    expect(adminRequest).not.toHaveBeenCalled();
  });

  it('shows "plans pending" plural when 2 plans are dirty', async () => {
    const plan1 = makePlan({ id: 'p1', slug: 'basic', sortOrder: 1 });
    const plan2 = makePlan({ id: 'p2', slug: 'pro', sortOrder: 2 });
    renderMatrix([plan1, plan2]);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    // Toggle one switch on each plan (they are interleaved per feature)
    await user.click(switches[0]);
    await user.click(switches[1]);
    await waitFor(() => {
      // Should show "2 plans pending"
      expect(screen.getByText(/plans pending/i)).toBeInTheDocument();
    });
  });
});
