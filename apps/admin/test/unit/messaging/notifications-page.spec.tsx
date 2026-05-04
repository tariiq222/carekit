import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import NotificationsPage from '@/app/(admin)/notifications/page';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock Radix-based Select with native <select> so onValueChange is reachable in jsdom
vi.mock('@deqah/ui/primitives/select', () => {
  const React = require('react');
  const SelectContext = React.createContext<{ onValueChange?: (v: string) => void; value?: string }>({});

  return {
    Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (v: string) => void; value?: string }) =>
      React.createElement(SelectContext.Provider, { value: { onValueChange, value } }, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) => React.createElement('span', null, placeholder),
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = React.useContext(SelectContext);
      return React.createElement(
        'select',
        {
          'data-testid': 'select-content',
          value: ctx.value ?? '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => ctx.onValueChange?.(e.target.value),
        },
        children,
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
      React.createElement('option', { value }, children),
  };
});

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
    queryClient,
  };
}

const EMPTY_RESPONSE = {
  items: [],
  meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
};

const MOCK_ITEMS = [
  {
    id: 'dl-1', organizationId: 'org-1', recipientId: 'user-1',
    type: 'BOOKING_CONFIRMED', priority: 'STANDARD' as const,
    channel: 'EMAIL' as const, status: 'SENT' as const,
    toAddress: 'owner@clinic.sa', providerName: 'resend',
    attempts: 1, lastAttemptAt: null, sentAt: '2026-05-01T10:00:00Z',
    errorMessage: null, jobId: null, createdAt: '2026-05-01T09:59:00Z',
  },
  {
    id: 'dl-2', organizationId: 'org-2', recipientId: 'user-2',
    type: 'PAYMENT_RECEIPT', priority: 'CRITICAL' as const,
    channel: 'SMS' as const, status: 'FAILED' as const,
    toAddress: '+966500000000', providerName: 'unifonic',
    attempts: 3, lastAttemptAt: null, sentAt: null,
    errorMessage: 'Rate limit exceeded', jobId: null, createdAt: '2026-05-01T09:55:00Z',
  },
  {
    id: 'dl-3', organizationId: 'org-1', recipientId: 'user-3',
    type: 'APPOINTMENT_REMINDER', priority: 'STANDARD' as const,
    channel: 'PUSH' as const, status: 'PENDING' as const,
    toAddress: null, providerName: 'fcm',
    attempts: 0, lastAttemptAt: null, sentAt: null,
    errorMessage: null, jobId: 'job-abc', createdAt: '2026-05-01T09:50:00Z',
  },
];

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders the page heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    expect(screen.getByText('Notification Delivery Log')).toBeTruthy();
  });

  it('renders filter inputs (Organization ID, Status, Channel)', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    expect(screen.getByPlaceholderText('UUID...')).toBeTruthy();
    expect(screen.getByText('All statuses')).toBeTruthy();
    expect(screen.getByText('All channels')).toBeTruthy();
  });

  it('shows stat cards with dash placeholders before load', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders stat cards Total, Sent, Failed, Pending after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 3, totalPages: 1 },
    });
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeTruthy();
      expect(screen.getByText('Sent (page)')).toBeTruthy();
      expect(screen.getByText('Failed (page)')).toBeTruthy();
      expect(screen.getByText('Pending (page)')).toBeTruthy();
      // total = 3; multiple elements may show '3' (stat card + table cells), use getAllByText
      const threes = screen.getAllByText('3');
      expect(threes.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('Network error'));
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/Failed to load: Network error/)).toBeTruthy();
    });
  });

  it('renders log table with items from API', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 3, totalPages: 1 },
    });
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('BOOKING_CONFIRMED')).toBeTruthy();
      expect(screen.getByText('PAYMENT_RECEIPT')).toBeTruthy();
    });
  });

  it('shows Reset button only when filters are active', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByPlaceholderText('UUID...'));
    // No filter active — no Reset button
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    // Set org ID filter
    await user.type(screen.getByPlaceholderText('UUID...'), 'org-abc');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
  });

  it('clears all filters when Reset is clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByPlaceholderText('UUID...'));
    await user.type(screen.getByPlaceholderText('UUID...'), 'org-abc');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    const orgInput = screen.getByPlaceholderText('UUID...') as HTMLInputElement;
    expect(orgInput.value).toBe('');
  });

  it('shows pagination when totalPages > 1', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 45, totalPages: 3 },
    });
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
      expect(screen.getByText(/Page 1 of 3/)).toBeTruthy();
    });
  });

  it('does not show pagination when totalPages <= 1', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 3, totalPages: 1 },
    });
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByText('BOOKING_CONFIRMED'));
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
  });

  it('Previous button is disabled on page 1', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 45, totalPages: 3 },
    });
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => {
      const prevBtn = screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement;
      expect(prevBtn.disabled).toBe(true);
    });
  });

  it('includes page in delivery log API call', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => expect(vi.mocked(adminRequest)).toHaveBeenCalled());
    const url = vi.mocked(adminRequest).mock.calls[0]![0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('perPage=20');
  });

  it('clicking Next advances to page 2', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 45, totalPages: 3 },
    });
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      const url = vi.mocked(adminRequest).mock.calls.at(-1)![0] as string;
      expect(url).toContain('page=2');
    });
  });

  it('clicking Next then Previous returns to page 1', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      items: MOCK_ITEMS,
      meta: { page: 1, perPage: 20, total: 45, totalPages: 3 },
    });
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => {
      const url = vi.mocked(adminRequest).mock.calls.at(-1)![0] as string;
      expect(url).toContain('page=1');
    });
  });

  it('changing status select filter fires API with status param', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByPlaceholderText('UUID...'));
    // Select components are mocked as native <select> elements
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    // First select = status, second = channel
    const statusSelect = selects[0]!;
    await user.selectOptions(statusSelect, 'SENT');
    await waitFor(() => {
      const calls = vi.mocked(adminRequest).mock.calls;
      const hasSent = calls.some(([url]) => (url as string).includes('status=SENT'));
      expect(hasSent).toBe(true);
    });
  });

  it('changing channel select filter fires API with channel param', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESPONSE);
    const user = userEvent.setup();
    const { wrapper } = makeWrapper();
    render(<NotificationsPage />, { wrapper });
    await waitFor(() => screen.getByPlaceholderText('UUID...'));
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const channelSelect = selects[1]!;
    await user.selectOptions(channelSelect, 'SMS');
    await waitFor(() => {
      const calls = vi.mocked(adminRequest).mock.calls;
      const hasSms = calls.some(([url]) => (url as string).includes('channel=SMS'));
      expect(hasSms).toBe(true);
    });
  });
});
