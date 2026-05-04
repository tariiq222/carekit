import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OrganizationsListPage from '@/app/(admin)/organizations/page';

const mockUseListOrganizations = vi.fn();

vi.mock('@/features/organizations/list-organizations/use-list-organizations', () => ({
  useListOrganizations: mockUseListOrganizations,
}));

vi.mock('@/features/organizations/create-tenant/create-tenant-dialog', () => ({
  CreateTenantDialog: function MockCreateTenantDialog({ open }: { open: boolean }) {
    return open ? <div data-testid="create-tenant-dialog">Create Tenant Dialog</div> : null;
  },
}));

vi.mock('@/features/organizations/list-organizations/organizations-filter-bar', () => ({
  OrganizationsFilterBar: function MockOrganizationsFilterBar() {
    return <div data-testid="organizations-filter-bar">OrganizationsFilterBar</div>;
  },
  type SuspendedFilter: vi.fn(),
  type LifecycleStatusFilter: vi.fn(),
}));

vi.mock('@/features/organizations/list-organizations/organizations-table', () => ({
  OrganizationsTable: function MockOrganizationsTable({
    items,
    isLoading,
  }: {
    items?: unknown[];
    isLoading: boolean;
  }) {
    return (
      <div data-testid="organizations-table">
        {isLoading ? 'Loading...' : `${items?.length ?? 0} organizations`}
      </div>
    );
  },
}));

const mockOrganizationsData = {
  items: [
    {
      id: 'org-1',
      slug: 'org-1',
      nameAr: 'Organization 1',
      nameEn: 'Organization 1 EN',
      status: 'ACTIVE',
      verticalId: null,
      trialEndsAt: null,
      suspendedAt: null,
      suspendedReason: null,
      createdAt: '2024-01-01',
      subscription: null,
    },
  ],
  meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
};

const messages = { organizations: { title: 'Organizations', description: 'Manage organizations' } };

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('OrganizationsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListOrganizations.mockReturnValue({
      data: mockOrganizationsData,
      isLoading: false,
      error: null,
    });
  });

  it('renders page title and description', () => {
    render(<OrganizationsListPage />, { wrapper });
    expect(screen.getByText('Organizations')).toBeInTheDocument();
    expect(screen.getByText('Manage organizations')).toBeInTheDocument();
  });

  it('renders filter bar and table', () => {
    render(<OrganizationsListPage />, { wrapper });
    expect(screen.getByTestId('organizations-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('organizations-table')).toBeInTheDocument();
  });

  it('renders error state when load fails', () => {
    mockUseListOrganizations.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    });

    render(<OrganizationsListPage />, { wrapper });
    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockUseListOrganizations.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<OrganizationsListPage />, { wrapper });
    expect(screen.getByTestId('organizations-table')).toHaveTextContent('Loading...');
  });

  it('renders pagination when multiple pages exist', () => {
    mockUseListOrganizations.mockReturnValue({
      data: { ...mockOrganizationsData, meta: { ...mockOrganizationsData.meta, totalPages: 2 } },
      isLoading: false,
      error: null,
    });

    render(<OrganizationsListPage />, { wrapper });
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });
});