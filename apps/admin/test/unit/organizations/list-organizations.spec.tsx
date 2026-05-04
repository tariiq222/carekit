import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useListOrganizations } from '@/features/organizations/list-organizations/use-list-organizations';
import { OrganizationsFilterBar } from '@/features/organizations/list-organizations/organizations-filter-bar';
import { OrganizationsTable } from '@/features/organizations/list-organizations/organizations-table';
import type { OrganizationRow } from '@/features/organizations/types';
import type { ListOrganizationsParams } from '@/features/organizations/list-organizations/list-organizations.api';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const FILTER_MESSAGES = {
  organizations: {
    filters: {
      search: 'Search by slug, Arabic or English name',
      suspended: 'Suspension',
      suspendedAll: 'All suspension states',
      activeOnly: 'Not suspended',
      suspendedOnly: 'Suspended only',
      status: 'Lifecycle',
      statusAll: 'All lifecycle states',
      verticalId: 'Vertical ID',
      planId: 'Plan ID',
      reset: 'Reset',
    },
    status: {
      TRIALING: 'Trialing',
      ACTIVE: 'Active',
      PAST_DUE: 'Past due',
      SUSPENDED: 'Suspended',
      ARCHIVED: 'Archived',
    },
    table: {
      slug: 'Slug',
      name: 'Name',
      plan: 'Plan',
      status: 'Status',
      created: 'Created',
      actions: 'Actions',
      open: 'Open',
      empty: 'No organizations match the current filters.',
      noPlan: 'No plan',
    },
  },
};

const MOCK_RESPONSE = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

const MOCK_ORG_ROW: OrganizationRow = {
  id: 'org-list-1',
  slug: 'test-clinic',
  nameAr: 'عيادة الاختبار',
  nameEn: 'Test Clinic',
  status: 'ACTIVE',
  verticalId: null,
  trialEndsAt: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: '2026-01-15T00:00:00Z',
  subscription: { status: 'ACTIVE', plan: { slug: 'basic', nameEn: 'Basic' } },
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useListOrganizations', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('fetches with page and perPage params', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const params: ListOrganizationsParams = { page: 1, perPage: 20 };
    const { result } = renderHook(() => useListOrganizations(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/organizations?page=1&perPage=20');
  });

  it('includes search param when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListOrganizations({ page: 1, perPage: 10, search: 'clinic' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(
      expect.stringContaining('search=clinic'),
    );
  });

  it('omits search param when search is empty string', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListOrganizations({ page: 1, perPage: 10, search: '' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).not.toHaveBeenCalledWith(expect.stringContaining('search='));
  });

  it('includes status param when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListOrganizations({ page: 1, perPage: 10, status: 'SUSPENDED' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(expect.stringContaining('status=SUSPENDED'));
  });

  it('includes suspended param when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListOrganizations({ page: 1, perPage: 10, suspended: 'true' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith(expect.stringContaining('suspended=true'));
  });

  it('includes verticalId and planId when provided', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () =>
        useListOrganizations({ page: 2, perPage: 10, verticalId: 'vert-1', planId: 'plan-1' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = vi.mocked(adminRequest).mock.calls[0][0] as string;
    expect(url).toContain('verticalId=vert-1');
    expect(url).toContain('planId=plan-1');
    expect(url).toContain('page=2');
  });

  it('uses correct queryKey structure', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_RESPONSE);
    const { wrapper, queryClient } = makeWrapper();

    const params: ListOrganizationsParams = { page: 1, perPage: 10, search: 'clinic' };
    const { result } = renderHook(() => useListOrganizations(params), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cache = queryClient.getQueryCache();
    const query = cache.find({
      queryKey: ['organizations', 'list', 1, 'clinic', '', '', '', ''],
    });
    expect(query).toBeDefined();
  });

  it('returns items and meta on success', async () => {
    const response = {
      items: [MOCK_ORG_ROW],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    vi.mocked(adminRequest).mockResolvedValue(response);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => useListOrganizations({ page: 1, perPage: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.meta.total).toBe(1);
  });
});

// ─── FilterBar tests ──────────────────────────────────────────────────────────

describe('OrganizationsFilterBar', () => {
  const defaultProps = {
    search: '',
    onSearchChange: vi.fn(),
    suspended: 'all' as const,
    onSuspendedChange: vi.fn(),
    status: 'all' as const,
    onStatusChange: vi.fn(),
    verticalId: '',
    onVerticalIdChange: vi.fn(),
    planId: '',
    onPlanIdChange: vi.fn(),
    onReset: vi.fn(),
  };

  function renderFilterBar(props = defaultProps) {
    render(
      <NextIntlClientProvider locale="en" messages={FILTER_MESSAGES}>
        <OrganizationsFilterBar {...props} />
      </NextIntlClientProvider>,
    );
  }

  beforeEach(() => {
    defaultProps.onSearchChange.mockReset();
    defaultProps.onSuspendedChange.mockReset();
    defaultProps.onStatusChange.mockReset();
    defaultProps.onVerticalIdChange.mockReset();
    defaultProps.onPlanIdChange.mockReset();
    defaultProps.onReset.mockReset();
    // Polyfill jsdom APIs missing for Radix UI Select
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
  });

  it('renders search input', () => {
    renderFilterBar();
    expect(
      screen.getByPlaceholderText(/search by slug, arabic or english name/i),
    ).toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await user.type(
      screen.getByPlaceholderText(/search by slug, arabic or english name/i),
      'clinic',
    );
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('renders Reset button and calls onReset when clicked', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('renders Vertical ID and Plan ID inputs', () => {
    renderFilterBar();
    expect(screen.getByPlaceholderText(/vertical id/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/plan id/i)).toBeInTheDocument();
  });

  it('calls onVerticalIdChange when vertical ID input changes', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await user.type(screen.getByPlaceholderText(/vertical id/i), 'v1');
    expect(defaultProps.onVerticalIdChange).toHaveBeenCalled();
  });

  it('calls onPlanIdChange when plan ID input changes', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    await user.type(screen.getByPlaceholderText(/plan id/i), 'plan-1');
    expect(defaultProps.onPlanIdChange).toHaveBeenCalled();
  });

  it('opens suspended select and calls onSuspendedChange on item click', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    // Click the first SelectTrigger (Suspension dropdown)
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]);
    const option = await screen.findByRole('option', { name: /suspended only/i });
    await user.click(option);
    expect(defaultProps.onSuspendedChange).toHaveBeenCalledWith('true');
  });

  it('opens status select and calls onStatusChange on item click', async () => {
    const user = userEvent.setup();
    renderFilterBar();
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]);
    const option = await screen.findByRole('option', { name: /trialing/i });
    await user.click(option);
    expect(defaultProps.onStatusChange).toHaveBeenCalledWith('TRIALING');
  });
});

// ─── Table tests ──────────────────────────────────────────────────────────────

describe('OrganizationsTable', () => {
  function renderTable(items: OrganizationRow[] | undefined, isLoading = false) {
    render(
      <NextIntlClientProvider locale="en" messages={FILTER_MESSAGES}>
        <OrganizationsTable items={items} isLoading={isLoading} />
      </NextIntlClientProvider>,
    );
  }

  it('renders skeleton rows while loading', () => {
    renderTable(undefined, true);
    const skeletons = document.querySelectorAll('[class*="h-6"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state message when items is empty array', () => {
    renderTable([]);
    expect(screen.getByText(/no organizations match/i)).toBeInTheDocument();
  });

  it('renders organization slug, name, and status', () => {
    renderTable([MOCK_ORG_ROW]);
    expect(screen.getByText('test-clinic')).toBeInTheDocument();
    expect(screen.getByText('عيادة الاختبار')).toBeInTheDocument();
    expect(screen.getByText('Test Clinic')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders subscription plan slug when subscription is present', () => {
    renderTable([MOCK_ORG_ROW]);
    expect(screen.getByText('basic')).toBeInTheDocument();
  });

  it('shows "No plan" when subscription is null', () => {
    renderTable([{ ...MOCK_ORG_ROW, subscription: null }]);
    expect(screen.getByText(/no plan/i)).toBeInTheDocument();
  });

  it('renders TRIALING status badge with primary class', () => {
    renderTable([{ ...MOCK_ORG_ROW, status: 'TRIALING' }]);
    const badge = screen.getByText('Trialing');
    expect(badge.className).toContain('text-primary');
  });

  it('renders ACTIVE status badge with success class', () => {
    renderTable([MOCK_ORG_ROW]);
    const badge = screen.getByText('Active');
    expect(badge.className).toContain('text-success');
  });

  it('renders SUSPENDED status badge with warning class', () => {
    renderTable([{ ...MOCK_ORG_ROW, status: 'SUSPENDED' }]);
    const badge = screen.getByText('Suspended');
    expect(badge.className).toContain('text-warning');
  });

  it('renders ARCHIVED status badge with muted class', () => {
    renderTable([{ ...MOCK_ORG_ROW, status: 'ARCHIVED' }]);
    const badge = screen.getByText('Archived');
    expect(badge.className).toContain('text-muted-foreground');
  });

  it('renders Open link pointing to organization detail page', () => {
    renderTable([MOCK_ORG_ROW]);
    const link = screen.getByRole('link', { name: /open/i });
    expect(link).toHaveAttribute('href', '/organizations/org-list-1');
  });
});
