import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeatureGroupSection } from '@/features/plans/features-tab/feature-group-section';
import { DEFAULT_PLAN_LIMITS } from '@/features/plans/plan-limits';
import type { FeatureKey } from '@deqah/shared';
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
  descEn: 'Appointment series',
};

const WAITLIST_ENTRY: CatalogEntry = {
  ...BOOL_ENTRY,
  key: 'waitlist' as never,
  nameEn: 'Waitlist',
  descEn: 'Waitlist management',
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

const BOOL_ENTRIES: Array<[FeatureKey, CatalogEntry]> = [
  ['recurring_bookings' as FeatureKey, BOOL_ENTRY],
  ['waitlist' as FeatureKey, WAITLIST_ENTRY],
];

const QUANT_ENTRIES: Array<[FeatureKey, CatalogEntry]> = [
  ['branches' as FeatureKey, QUANT_ENTRY],
];

describe('FeatureGroupSection', () => {
  it('returns null when entries is empty', () => {
    const { container } = render(
      <FeatureGroupSection
        groupLabel="Empty Group"
        entries={[]}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders group label', () => {
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={BOOL_ENTRIES}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByText('Booking & Scheduling')).toBeInTheDocument();
  });

  it('shows enabled count and total count', () => {
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={BOOL_ENTRIES}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    // 0 enabled / 2 total since DEFAULT_PLAN_LIMITS has all false
    expect(screen.getByText(/0 enabled \/ 2 total/i)).toBeInTheDocument();
  });

  it('counts enabled boolean features correctly', () => {
    const limitsWithEnabled = { ...DEFAULT_PLAN_LIMITS, recurring_bookings: true };
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={BOOL_ENTRIES}
        limits={limitsWithEnabled}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByText(/1 enabled \/ 2 total/i)).toBeInTheDocument();
  });

  it('renders child FeatureRow for each entry', () => {
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={BOOL_ENTRIES}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByText('Recurring Bookings')).toBeInTheDocument();
    expect(screen.getByText('Waitlist')).toBeInTheDocument();
  });

  it('is open by default (details element has open attribute)', () => {
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={BOOL_ENTRIES}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    const details = document.querySelector('details');
    expect(details).toHaveAttribute('open');
  });

  it('renders quantitative entry with number input', () => {
    render(
      <FeatureGroupSection
        groupLabel="Operations"
        entries={QUANT_ENTRIES}
        limits={{ ...DEFAULT_PLAN_LIMITS, maxBranches: 5 }}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(screen.getByText('Branches')).toBeInTheDocument();
  });

  it('calls onToggle when boolean Switch is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <FeatureGroupSection
        groupLabel="Booking & Scheduling"
        entries={[['recurring_bookings' as FeatureKey, BOOL_ENTRY]]}
        limits={DEFAULT_PLAN_LIMITS}
        onToggle={onToggle}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch'));
    expect(onToggle).toHaveBeenCalledWith('recurring_bookings', true);
  });

  it('calls onNumberChange when quantitative input changes', async () => {
    const onNumberChange = vi.fn();
    render(
      <FeatureGroupSection
        groupLabel="Operations"
        entries={QUANT_ENTRIES}
        limits={{ ...DEFAULT_PLAN_LIMITS, maxBranches: 1 }}
        onToggle={vi.fn()}
        onNumberChange={onNumberChange}
        idPrefix="test"
      />,
    );
    const user = userEvent.setup();
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '5');
    expect(onNumberChange).toHaveBeenCalled();
  });

  it('counts quantitative entry as enabled when quota is non-zero', () => {
    render(
      <FeatureGroupSection
        groupLabel="Operations"
        entries={QUANT_ENTRIES}
        limits={{ ...DEFAULT_PLAN_LIMITS, maxBranches: 5 }}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    // maxBranches=5 is non-zero so branch is "enabled"
    expect(screen.getByText(/1 enabled \/ 1 total/i)).toBeInTheDocument();
  });

  it('counts quantitative entry as NOT enabled when quota is 0', () => {
    render(
      <FeatureGroupSection
        groupLabel="Operations"
        entries={QUANT_ENTRIES}
        limits={{ ...DEFAULT_PLAN_LIMITS, maxBranches: 0 }}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByText(/0 enabled \/ 1 total/i)).toBeInTheDocument();
  });

  it('counts quantitative entry with -1 (unlimited) as enabled', () => {
    render(
      <FeatureGroupSection
        groupLabel="Operations"
        entries={QUANT_ENTRIES}
        limits={{ ...DEFAULT_PLAN_LIMITS, maxBranches: -1 }}
        onToggle={vi.fn()}
        onNumberChange={vi.fn()}
        idPrefix="test"
      />,
    );
    expect(screen.getByText(/1 enabled \/ 1 total/i)).toBeInTheDocument();
  });
});
