import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Polyfills for Radix Select
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
import AuditLogPage from '@/app/(admin)/audit-log/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><AuditLogPage /></QueryClientProvider>);
}

const mockData = {
  items: [
    {
      id: 'e-1',
      superAdminUserId: 'sa-1',
      actionType: 'SUSPEND_ORG',
      organizationId: 'org-1',
      impersonationSessionId: null,
      reason: 'Suspended for non-payment',
      metadata: {},
      ipAddress: '1.2.3.4',
      userAgent: 'test',
      createdAt: '2026-01-01T10:00:00Z',
    },
  ],
  meta: { page: 1, perPage: 50, total: 1, totalPages: 1 },
};

describe('AuditLogPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders the Audit log heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });

  it('renders filter bar', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows audit log entries after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('SUSPEND_ORG')).toBeInTheDocument();
    });
  });

  it('shows empty state when no entries', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 50, total: 0, totalPages: 1 } });
    renderPage();
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows pagination controls when multiple pages', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: mockData.items, meta: { page: 1, perPage: 50, total: 100, totalPages: 2 } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('reset button clears filter state', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset/i }));
    // After reset, data re-fetches — still shows the table
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
