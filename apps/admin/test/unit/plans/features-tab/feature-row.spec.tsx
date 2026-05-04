import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeatureRow } from '@/features/plans/features-tab/feature-row';
import type { CatalogEntry } from '@/features/plans/features-tab/filter';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

const BOOL_ENTRY: CatalogEntry = {
  key: 'recurring_bookings' as never,
  kind: 'boolean',
  tier: 'PRO',
  group: 'Booking & Scheduling',
  nameAr: 'الحجوزات المتكررة',
  nameEn: 'Recurring Bookings',
  descAr: 'وصف',
  descEn: 'Create weekly or monthly appointment series',
};

const ENTERPRISE_BOOL_ENTRY: CatalogEntry = {
  ...BOOL_ENTRY,
  key: 'white_label_mobile' as never,
  tier: 'ENTERPRISE',
  nameEn: 'White-label Mobile',
  descEn: 'Custom branded mobile app',
};

const QUANT_ENTRY: CatalogEntry = {
  key: 'branches' as never,
  kind: 'quantitative',
  tier: 'PRO',
  group: 'Operations',
  nameAr: 'الفروع',
  nameEn: 'Branches',
  descAr: 'عدد الفروع',
  descEn: 'Number of branches',
};

describe('FeatureRow — boolean kind', () => {
  it('renders feature name and description', () => {
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('Recurring Bookings')).toBeInTheDocument();
    expect(screen.getByText(/create weekly or monthly/i)).toBeInTheDocument();
  });

  it('renders PRO tier badge', () => {
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });

  it('renders ENTERPRISE tier badge', () => {
    render(
      <FeatureRow
        featureKey="white_label_mobile"
        entry={ENTERPRISE_BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText('ENTERPRISE')).toBeInTheDocument();
  });

  it('renders Switch checked=false when enabled=false', () => {
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('renders Switch checked=true when enabled=true', () => {
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('calls onToggle when Switch is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={onToggle}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('does not render number input for boolean kind', () => {
    render(
      <FeatureRow
        featureKey="recurring_bookings"
        entry={BOOL_ENTRY}
        idPrefix="plan-test"
        kind="boolean"
        enabled={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});

describe('FeatureRow — quantitative kind', () => {
  it('renders feature name', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={5}
        onQuotaChange={vi.fn()}
        quotaHint="-1 = unlimited"
      />,
    );
    expect(screen.getByText('Branches')).toBeInTheDocument();
  });

  it('renders number input with current quota value', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={10}
        onQuotaChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(10);
  });

  it('renders quota hint when provided', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={-1}
        onQuotaChange={vi.fn()}
        quotaHint="-1 = unlimited"
      />,
    );
    expect(screen.getByText('-1 = unlimited')).toBeInTheDocument();
  });

  it('does not render quota hint when not provided', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={5}
        onQuotaChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/-1 = unlimited/i)).not.toBeInTheDocument();
  });

  it('calls onQuotaChange when user changes number input', async () => {
    const onQuotaChange = vi.fn();
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={5}
        onQuotaChange={onQuotaChange}
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '10');
    expect(onQuotaChange).toHaveBeenCalled();
  });

  it('does not render Switch for quantitative kind', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={5}
        onQuotaChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('defaults quotaValue to 0 when undefined', () => {
    render(
      <FeatureRow
        featureKey="branches"
        entry={QUANT_ENTRY}
        idPrefix="plan-test"
        kind="quantitative"
        quotaValue={undefined}
        onQuotaChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('spinbutton')).toHaveValue(0);
  });
});
