import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiffPreviewDialog } from '@/features/plans/features-tab/diff-preview-dialog';
import type { FeatureKey } from '@deqah/shared';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

const DOWNGRADES: FeatureKey[] = ['recurring_bookings', 'ai_chatbot'];

function renderDialog(overrides?: {
  open?: boolean;
  onOpenChange?: ReturnType<typeof vi.fn>;
  downgrades?: FeatureKey[];
  activeSubscribers?: number;
  onConfirm?: ReturnType<typeof vi.fn>;
}) {
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  const onConfirm = overrides?.onConfirm ?? vi.fn();
  render(
    <DiffPreviewDialog
      open={overrides?.open ?? true}
      onOpenChange={onOpenChange}
      downgrades={overrides?.downgrades ?? DOWNGRADES}
      activeSubscribers={overrides?.activeSubscribers ?? 3}
      onConfirm={onConfirm}
    />,
  );
  return { onOpenChange, onConfirm };
}

describe('DiffPreviewDialog', () => {
  it('renders dialog title', () => {
    renderDialog();
    expect(screen.getByText(/confirm destructive plan change/i)).toBeInTheDocument();
  });

  it('shows active subscriber count (singular)', () => {
    renderDialog({ activeSubscribers: 1 });
    expect(screen.getByText(/1 active subscriber/i)).toBeInTheDocument();
  });

  it('shows active subscriber count (plural)', () => {
    renderDialog({ activeSubscribers: 5 });
    expect(screen.getByText(/5 active subscribers/i)).toBeInTheDocument();
  });

  it('renders list of downgrade feature names', () => {
    renderDialog();
    // recurring_bookings → "Recurring Bookings" from FEATURE_CATALOG
    expect(screen.getByText(/recurring bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/ai chatbot/i)).toBeInTheDocument();
  });

  it('renders single feature without plural suffix in heading', () => {
    renderDialog({ downgrades: ['waitlist' as FeatureKey] });
    expect(screen.getByText(/following feature\b/i)).toBeInTheDocument();
  });

  it('renders plural "features" heading when multiple downgrades', () => {
    renderDialog({ downgrades: DOWNGRADES });
    expect(screen.getByText(/following features/i)).toBeInTheDocument();
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Confirm and save button calls onConfirm', async () => {
    const { onConfirm } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /confirm and save/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not render when open=false', () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/confirm destructive plan change/i)).not.toBeInTheDocument();
  });

  it('renders feature key as fallback when not in FEATURE_CATALOG', () => {
    renderDialog({ downgrades: ['unknown_feature_key' as FeatureKey] });
    expect(screen.getByText('unknown_feature_key')).toBeInTheDocument();
  });

  it('renders zero subscribers text', () => {
    renderDialog({ activeSubscribers: 0 });
    expect(screen.getByText(/0 active subscribers/i)).toBeInTheDocument();
  });
});
