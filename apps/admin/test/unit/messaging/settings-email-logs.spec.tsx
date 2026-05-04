import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import EmailLogsPage from '@/app/(admin)/settings/email/logs/page';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MOCK_LOG_ROW = {
  id: 'log-1',
  organizationId: 'org-abc',
  templateSlug: 'tenant-welcome',
  toAddress: 'owner@clinic.sa',
  status: 'SENT' as const,
  providerMessageId: 'resend-msg-001',
  errorMessage: null,
  createdAt: '2026-05-01T10:00:00Z',
  sentAt: '2026-05-01T10:00:02Z',
};

const EMPTY_RESULT = { items: [], nextCursor: null };
const SINGLE_RESULT = { items: [MOCK_LOG_ROW], nextCursor: null };

describe('EmailLogsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmailLogsPage />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the page heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
    render(<EmailLogsPage />);
    expect(screen.getByText('Email Delivery Logs')).toBeTruthy();
  });

  it('renders filters: status select, slug input, org input', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeTruthy();
      expect(screen.getByPlaceholderText('Filter by template slug')).toBeTruthy();
      expect(screen.getByPlaceholderText('Filter by org ID')).toBeTruthy();
    });
  });

  it('shows empty state when no items', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('No delivery log entries match the current filters.')).toBeTruthy();
    });
  });

  it('renders a log row with template slug and address', async () => {
    vi.mocked(adminRequest).mockResolvedValue(SINGLE_RESULT);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('tenant-welcome')).toBeTruthy();
      expect(screen.getByText('owner@clinic.sa')).toBeTruthy();
    });
  });

  it('renders SENT status badge', async () => {
    vi.mocked(adminRequest).mockResolvedValue(SINGLE_RESULT);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('sent')).toBeTruthy();
    });
  });

  it('renders FAILED status badge', async () => {
    const failedResult = {
      items: [{ ...MOCK_LOG_ROW, id: 'log-2', status: 'FAILED' as const, errorMessage: 'Mailbox full' }],
      nextCursor: null,
    };
    vi.mocked(adminRequest).mockResolvedValue(failedResult);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('failed')).toBeTruthy();
    });
  });

  it('renders QUEUED status badge', async () => {
    const queuedResult = {
      items: [{ ...MOCK_LOG_ROW, id: 'log-3', status: 'QUEUED' as const }],
      nextCursor: null,
    };
    vi.mocked(adminRequest).mockResolvedValue(queuedResult);
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('queued')).toBeTruthy();
    });
  });

  it('shows error state on API failure', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Unauthorized'));
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeTruthy();
    });
  });

  it('reloads logs when status filter changes', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
    const user = userEvent.setup();
    render(<EmailLogsPage />);
    await waitFor(() => screen.getByRole('combobox'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await user.selectOptions(select, 'FAILED');
    await waitFor(() => {
      const calls = vi.mocked(adminRequest).mock.calls;
      // At least one call with FAILED in the URL
      const hasFailed = calls.some(([url]) => (url as string).includes('status=FAILED'));
      expect(hasFailed).toBe(true);
    });
  });

  it('resets filters when Reset button is clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(EMPTY_RESULT);
    const user = userEvent.setup();
    render(<EmailLogsPage />);
    await waitFor(() => screen.getByPlaceholderText('Filter by template slug'));
    await user.type(screen.getByPlaceholderText('Filter by template slug'), 'billing');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    const slugInput = screen.getByPlaceholderText('Filter by template slug') as HTMLInputElement;
    expect(slugInput.value).toBe('');
  });

  it('shows Load more button when nextCursor is set', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [MOCK_LOG_ROW], nextCursor: 'cursor-next' });
    render(<EmailLogsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy();
    });
  });

  it('does not show Load more when nextCursor is null', async () => {
    vi.mocked(adminRequest).mockResolvedValue(SINGLE_RESULT);
    render(<EmailLogsPage />);
    await waitFor(() => screen.getByText('tenant-welcome'));
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});
