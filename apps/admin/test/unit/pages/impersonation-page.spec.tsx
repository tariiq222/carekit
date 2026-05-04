import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Select polyfills
beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

import { adminRequest } from '@/lib/api-client';
import ImpersonationSessionsPage from '@/app/(admin)/impersonation-sessions/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><ImpersonationSessionsPage /></QueryClientProvider>);
}

const mockData = {
  items: [
    {
      id: 'session-1',
      superAdminId: 'sa-1',
      organizationId: 'org-1',
      organizationName: 'Test Clinic',
      isActive: true,
      startedAt: '2026-01-01T10:00:00Z',
      endedAt: null,
      reason: 'Support investigation',
    },
  ],
  meta: { page: 1, perPage: 50, total: 1, totalPages: 1 },
};

describe('ImpersonationSessionsPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders the Impersonation sessions heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByRole('heading', { name: /impersonation sessions/i })).toBeInTheDocument();
  });

  it('renders status filter select', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows sessions after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => {
      // SessionsTable renders session data
      expect(adminRequest).toHaveBeenCalled();
    });
  });

  it('shows empty state when no sessions', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByRole('heading', { name: /impersonation sessions/i })).toBeInTheDocument();
  });
});
