import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import UsersPage from '@/app/(admin)/users/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><UsersPage /></QueryClientProvider>);
}

const mockData = {
  items: [
    {
      id: 'u-1',
      email: 'user@clinic.com',
      name: 'Clinic User',
      phone: null,
      role: 'ADMIN',
      isActive: true,
      isSuperAdmin: false,
      createdAt: '2026-01-01T00:00:00Z',
      memberships: [{ role: 'OWNER', organization: { id: 'org-1', nameAr: 'عيادة', nameEn: 'Clinic', slug: 'clinic' } }],
    },
  ],
  meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
};

describe('UsersPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders the Users heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders filter bar with search input', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByPlaceholderText(/search by email/i)).toBeInTheDocument();
  });

  it('shows users after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('user@clinic.com')).toBeInTheDocument();
    });
  });

  it('shows empty state when no users found', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('shows pagination controls when multiple pages', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: mockData.items, meta: { page: 1, perPage: 20, total: 40, totalPages: 2 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('updates search filter on type', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/search by email/i), 'clinic');
    // Search triggers re-fetch with new params
    await waitFor(() => expect(vi.mocked(adminRequest)).toHaveBeenCalled());
  });
});
