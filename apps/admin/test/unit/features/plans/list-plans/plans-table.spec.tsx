import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlansTable } from '@/features/plans/list-plans/plans-table';
import type { PlanRow } from '@/features/plans/types';

const mockPlan: PlanRow = {
  id: 'plan-1',
  slug: 'basic',
  nameAr: 'الأساسية',
  nameEn: 'Basic',
  priceMonthly: 99.00,
  priceAnnual: 990.00,
  currency: 'USD',
  isActive: true,
  _count: { subscriptions: 5 },
};

const mockPlanInactive: PlanRow = {
  id: 'plan-2',
  slug: 'premium',
  nameAr: 'المميزة',
  nameEn: 'Premium',
  priceMonthly: 199.00,
  priceAnnual: 1990.00,
  currency: 'USD',
  isActive: false,
  _count: { subscriptions: 0 },
};

describe('PlansTable', () => {
  const defaultProps = {
    items: [mockPlan, mockPlanInactive],
    isLoading: false,
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plan rows correctly', () => {
    render(<PlansTable {...defaultProps} />);

    expect(screen.getByText('basic')).toBeInTheDocument();
    expect(screen.getByText('الأساسية')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('renders subscriber count badge for active plan', () => {
    render(<PlansTable {...defaultProps} />);

    expect(screen.getByTitle('5 active subscribers')).toBeInTheDocument();
  });

  it('renders Edit and Delete action buttons', () => {
    render(<PlansTable {...defaultProps} />);

    const editButtons = screen.getAllByRole('link', { name: /edit/i });
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });

    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  it('calls onDelete with correct plan when delete clicked', () => {
    render(<PlansTable {...defaultProps} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockPlan);
  });

  it('shows empty state when no plans', () => {
    render(<PlansTable {...defaultProps} items={[]} />);

    expect(screen.getByText(/no plans defined/i)).toBeInTheDocument();
  });

  it('renders Active badge for active plan', () => {
    render(<PlansTable {...defaultProps} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders Inactive badge for inactive plan', () => {
    render(<PlansTable {...defaultProps} />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
