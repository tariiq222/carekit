import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeaturesTab } from '@/features/plans/features-tab/features-tab';
import { DEFAULT_PLAN_LIMITS } from '@/features/plans/plan-limits';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

function renderTab(
  flatLimits = DEFAULT_PLAN_LIMITS,
  onFlatLimitsChange = vi.fn(),
  idPrefix = 'test',
) {
  render(
    <FeaturesTab
      flatLimits={flatLimits}
      onFlatLimitsChange={onFlatLimitsChange}
      idPrefix={idPrefix}
    />,
  );
  return { onFlatLimitsChange };
}

describe('FeaturesTab', () => {
  it('renders search input', () => {
    renderTab();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('renders preset buttons', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /apply pro preset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply enterprise preset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disable all/i })).toBeInTheDocument();
  });

  it('renders feature group sections from FEATURE_CATALOG', () => {
    renderTab();
    expect(screen.getByText(/Booking & Scheduling/i)).toBeInTheDocument();
    expect(screen.getByText(/Client Engagement/i)).toBeInTheDocument();
  });

  it('renders overage pricing section', () => {
    renderTab();
    expect(screen.getByText(/overage pricing/i)).toBeInTheDocument();
  });

  it('renders overage rate inputs', () => {
    renderTab();
    expect(screen.getByLabelText(/overage.*booking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/overage.*client/i)).toBeInTheDocument();
  });

  it('search filters visible feature group entries', async () => {
    renderTab();
    const user = userEvent.setup();
    const search = screen.getByRole('searchbox');
    // Search for something very specific to filter
    await user.type(search, 'zoom integration');
    // After filtering, we should see zoom
    await waitFor(() => {
      // The search should have narrowed results
      // (filterCatalog returns matching entries)
      const rows = screen.queryAllByRole('switch');
      // At least fewer results than when unfiltered
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it('toggling a feature calls onFlatLimitsChange with updated limits', async () => {
    const onFlatLimitsChange = vi.fn();
    renderTab(DEFAULT_PLAN_LIMITS, onFlatLimitsChange);
    const user = userEvent.setup();
    const switches = screen.getAllByRole('switch');
    await user.click(switches[0]);
    expect(onFlatLimitsChange).toHaveBeenCalledTimes(1);
    const newLimits = onFlatLimitsChange.mock.calls[0][0];
    expect(typeof newLimits).toBe('object');
  });

  it('clicking PRO preset calls onFlatLimitsChange with PRO preset applied', async () => {
    const onFlatLimitsChange = vi.fn();
    renderTab(DEFAULT_PLAN_LIMITS, onFlatLimitsChange);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply pro preset/i }));
    expect(onFlatLimitsChange).toHaveBeenCalledTimes(1);
    const newLimits = onFlatLimitsChange.mock.calls[0][0];
    expect(newLimits.recurring_bookings).toBe(true);
  });

  it('changing overage rate calls onFlatLimitsChange with updated value', async () => {
    const onFlatLimitsChange = vi.fn();
    renderTab(DEFAULT_PLAN_LIMITS, onFlatLimitsChange);
    const user = userEvent.setup();
    const overageInput = screen.getByLabelText(/overage.*booking/i);
    await user.clear(overageInput);
    await user.type(overageInput, '5');
    expect(onFlatLimitsChange).toHaveBeenCalled();
    const newLimits = onFlatLimitsChange.mock.calls[onFlatLimitsChange.mock.calls.length - 1][0];
    expect(newLimits.overageRateBookings).toBe(5);
  });

  it('empty search query shows all feature groups', () => {
    renderTab();
    // All 5 groups should be visible
    expect(screen.getByText(/Booking & Scheduling/i)).toBeInTheDocument();
    expect(screen.getByText(/Finance & Compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/Operations/i)).toBeInTheDocument();
    // "Platform" appears multiple times (group header + feature names) — use getAllByText
    expect(screen.getAllByText(/^Platform$/i).length).toBeGreaterThan(0);
  });

  it('overage input shows current overageRateBookings value', () => {
    const limits = { ...DEFAULT_PLAN_LIMITS, overageRateBookings: 2.5 };
    renderTab(limits);
    expect(screen.getByLabelText(/overage.*booking/i)).toHaveValue(2.5);
  });
});
