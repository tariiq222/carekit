import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import { useSearchUsers } from '@/features/users/search-users/use-search-users';
import { UsersFilterBar } from '@/features/users/search-users/users-filter-bar';
import { UsersTable } from '@/features/users/search-users/users-table';
import type { UserRow } from '@/features/users/types';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u-1',
    email: 'user@test.com',
    name: 'Test User',
    phone: null,
    role: 'ADMIN',
    isActive: true,
    isSuperAdmin: false,
    createdAt: '2026-01-01T00:00:00Z',
    memberships: [{ role: 'OWNER', organization: { id: 'org-1', nameAr: 'عيادة', nameEn: 'Clinic', slug: 'clinic' } }],
    ...overrides,
  };
}

describe('useSearchUsers hook', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('calls /users with search params', async () => {
    const mockData = { items: [makeUser()], meta: { page: 1, perPage: 20, total: 1, totalPages: 1 } };
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    const { result } = renderHook(() => useSearchUsers({ page: 1, perPage: 20, search: 'user' }), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(adminRequest).toHaveBeenCalledWith(expect.stringContaining('/users'));
  });
});

describe('UsersFilterBar', () => {
  const onSearchChange = vi.fn();
  const onOrganizationIdChange = vi.fn();
  const onReset = vi.fn();

  beforeEach(() => {
    onSearchChange.mockReset();
    onOrganizationIdChange.mockReset();
    onReset.mockReset();
  });

  it('renders search input', () => {
    render(
      <UsersFilterBar
        search=""
        onSearchChange={onSearchChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    expect(screen.getByPlaceholderText(/search by email/i)).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in search', async () => {
    render(
      <UsersFilterBar
        search=""
        onSearchChange={onSearchChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search by email/i), 'test');
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('calls onReset when Reset button clicked', async () => {
    render(
      <UsersFilterBar
        search="something"
        onSearchChange={onSearchChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('calls onOrganizationIdChange when typing in org id input', async () => {
    render(
      <UsersFilterBar
        search=""
        onSearchChange={onSearchChange}
        organizationId=""
        onOrganizationIdChange={onOrganizationIdChange}
        onReset={onReset}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/organization id/i), 'org-uuid');
    expect(onOrganizationIdChange).toHaveBeenCalled();
  });
});

describe('UsersTable', () => {
  function renderTable(items: UserRow[] | undefined, isLoading = false) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <UsersTable items={items} isLoading={isLoading} />
      </QueryClientProvider>,
    );
  }

  it('renders loading skeletons when isLoading=true', () => {
    renderTable(undefined, true);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('renders user data', () => {
    renderTable([makeUser()]);
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows active badge', () => {
    renderTable([makeUser({ isActive: true })]);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows inactive badge', () => {
    renderTable([makeUser({ isActive: false })]);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows super-admin badge for super-admin users', () => {
    renderTable([makeUser({ isSuperAdmin: true })]);
    expect(screen.getByText(/super-admin/i)).toBeInTheDocument();
  });

  it('shows organization name', () => {
    renderTable([makeUser()]);
    expect(screen.getByText('عيادة')).toBeInTheDocument();
  });

  it('shows empty message when items is empty', () => {
    renderTable([]);
    expect(screen.getByText(/no users match/i)).toBeInTheDocument();
  });
});
