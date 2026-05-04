import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, waitFor } from 'vitest';
import OrganizationDetailPage from '@/app/(admin)/organizations/[id]/page';

const mockUseGetOrganization = vi.fn();
const mockUseGetOrgBilling = vi.fn();

vi.mock('@/features/organizations/get-organization/use-get-organization', () => ({
  useGetOrganization: mockUseGetOrganization,
}));

vi.mock('@/features/organizations/get-org-billing/use-get-org-billing', () => ({
  useGetOrgBilling: mockUseGetOrgBilling,
}));

vi.mock('@/features/organizations/suspend-organization/suspend-dialog', () => ({
  SuspendDialog: function MockSuspendDialog() {
    return <div data-testid="suspend-dialog">Suspend Dialog</div>;
  },
}));

vi.mock('@/features/organizations/reinstate-organization/reinstate-dialog', () => ({
  ReinstateDialog: function MockReinstateDialog() {
    return <div data-testid="reinstate-dialog">Reinstate Dialog</div>;
  },
}));

vi.mock('@/features/impersonation/start-impersonation/impersonate-dialog', () => ({
  ImpersonateDialog: function MockImpersonateDialog() {
    return <div data-testid="impersonate-dialog">Impersonate Dialog</div>;
  },
}));

vi.mock('@/features/organizations/change-plan/change-plan-dialog', () => ({
  ChangePlanDialog: function MockChangePlanDialog() {
    return <div data-testid="change-plan-dialog">Change Plan Dialog</div>;
  },
}));

vi.mock('@/features/organizations/archive-organization/archive-dialog', () => ({
  ArchiveDialog: function MockArchiveDialog() {
    return <div data-testid="archive-dialog">Archive Dialog</div>;
  },
}));

vi.mock('@/features/organizations/update-organization/update-organization-dialog', () => ({
  UpdateOrganizationDialog: function MockUpdateOrganizationDialog() {
    return <div data-testid="update-organization-dialog">Update Organization Dialog</div>;
  },
}));

const mockOrganization = {
  id: 'org-1',
  slug: 'org-1',
  nameAr: 'Test Organization',
  nameEn: 'Test Organization EN',
  status: 'ACTIVE',
  verticalId: null,
  trialEndsAt: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: '2024-01-01',
  subscription: { status: 'ACTIVE', plan: { slug: 'basic', nameEn: 'Basic' } },
  stats: { memberCount: 10, bookingCount30d: 50, totalRevenue: 1000 },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{}}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('OrganizationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetOrganization.mockReturnValue({
      data: mockOrganization,
      isLoading: false,
      error: null,
    });
    mockUseGetOrgBilling.mockReturnValue({
      data: { subscription: null },
    });
  });

  it('renders organization details', async () => {
    const params = Promise.resolve({ id: 'org-1' });
    render(<OrganizationDetailPage params={params} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test Organization')).toBeInTheDocument();
    });
  });

  it('renders loading skeleton when loading', async () => {
    mockUseGetOrganization.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockUseGetOrgBilling.mockReturnValue({
      data: undefined,
    });

    const params = Promise.resolve({ id: 'org-1' });
    render(<OrganizationDetailPage params={params} />, { wrapper });

    await waitFor(() => {
      expect(document.querySelector('[class*="h-48"]')).toBeInTheDocument();
    });
  });

  it('renders error state when load fails', async () => {
    mockUseGetOrganization.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    });
    mockUseGetOrgBilling.mockReturnValue({
      data: undefined,
    });

    const params = Promise.resolve({ id: 'org-1' });
    render(<OrganizationDetailPage params={params} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  it('renders suspended organization warning', async () => {
    mockUseGetOrganization.mockReturnValue({
      data: { ...mockOrganization, status: 'SUSPENDED', suspendedAt: '2024-01-15T00:00:00Z' },
      isLoading: false,
      error: null,
    });
    mockUseGetOrgBilling.mockReturnValue({
      data: { subscription: null },
    });

    const params = Promise.resolve({ id: 'org-1' });
    render(<OrganizationDetailPage params={params} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/SUSPENDED/i)).toBeInTheDocument();
    });
  });
});