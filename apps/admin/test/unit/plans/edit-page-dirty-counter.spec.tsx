import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock useUpdatePlan — returns a never-pending, never-erroring mutation stub
vi.mock('@/features/plans/update-plan/use-update-plan', () => ({
  useUpdatePlan: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Import after mocks are set up
import { PlanEditForm } from '@/app/(admin)/plans/[id]/edit/plan-edit-form';
import type { PlanRow } from '@/features/plans/types';

// Minimal fixture plan — recurring_bookings: false so toggling it creates 1 dirty change
const FIXTURE_PLAN: PlanRow = {
  id: 'plan-test-1',
  slug: 'starter',
  nameAr: 'المبتدئ',
  nameEn: 'Starter',
  priceMonthly: 99,
  priceAnnual: 999,
  currency: 'SAR',
  isActive: true,
  sortOrder: 1,
  limits: { recurring_bookings: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  _count: { subscriptions: 0 },
};

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PlanEditForm — dirty counter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows no dirty hint on initial render and Save is disabled', () => {
    renderWithQuery(<PlanEditForm plan={FIXTURE_PLAN} />);

    // Save button should be disabled (no reason entered)
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();

    // No dirty hint should be in the DOM
    expect(screen.queryByText(/change.*pending/i)).not.toBeInTheDocument();
  });

  it('shows dirty hint with reason warning after toggling a feature', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PlanEditForm plan={FIXTURE_PLAN} />);

    // Switch to Features tab using userEvent for proper Radix pointer events
    const featuresTab = screen.getByRole('tab', { name: /features/i });
    await user.click(featuresTab);

    // Find the Recurring bookings switch (aria-label = entry.nameEn from FeatureRow)
    const recurringSwitch = screen.getByRole('switch', { name: /recurring/i });
    await user.click(recurringSwitch);

    // Dirty hint should appear with reason warning — reason field is now in the global footer
    const hint = screen.getByText(/1 change pending — add a reason \(min 10 chars\) below to save/i);
    expect(hint).toBeInTheDocument();

    // Save button still disabled (no reason yet)
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn).toHaveAttribute(
      'title',
      'Add a reason (min 10 chars) in the field below to enable saving.',
    );
  });

  it('hint drops the reason warning and Save becomes enabled after typing a 10-char reason', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PlanEditForm plan={FIXTURE_PLAN} />);

    // Toggle a feature to create a dirty change
    const featuresTab = screen.getByRole('tab', { name: /features/i });
    await user.click(featuresTab);

    const recurringSwitch = screen.getByRole('switch', { name: /recurring/i });
    await user.click(recurringSwitch);

    // Reason textarea is now always visible in the global footer — no tab switch needed
    const reasonTextarea = screen.getByLabelText(/reason \(min 10 chars\)/i);
    await user.type(reasonTextarea, 'Updated plan features for testing');

    // Hint should show count only, without reason warning
    // Text is: "1 change pending" (no suffix since reason is valid)
    const hint = screen.getByText(/1 change pending$/i);
    expect(hint).toBeInTheDocument();
    expect(screen.queryByText(/add a reason/i)).not.toBeInTheDocument();

    // Save button should now be enabled
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).not.toBeDisabled();
    expect(saveBtn).not.toHaveAttribute('title');
  });
});
