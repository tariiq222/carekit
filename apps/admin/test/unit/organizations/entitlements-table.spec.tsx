import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntitlementsTable } from '@/features/organizations/entitlements/entitlements-table';

describe('EntitlementsTable', () => {
  it('renders 5 group sections', () => {
    render(
      <EntitlementsTable
        organizationId="org-1"
        planDefaults={{}}
        currentOverrides={{}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByText('Booking & Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Client Engagement')).toBeInTheDocument();
    expect(screen.getByText('Finance & Compliance')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
  });

  it('Save button is disabled when there are 0 changes', () => {
    const onSave = vi.fn();
    render(
      <EntitlementsTable
        organizationId="org-1"
        planDefaults={{}}
        currentOverrides={{}}
        onSave={onSave}
      />,
    );
    const btn = screen.getByRole('button', { name: /save 0/i });
    expect(btn).toBeDisabled();
  });
});
