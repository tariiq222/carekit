import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/settings/health',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

import { adminRequest } from '@/lib/api-client';
import SystemHealthPage from '@/app/(admin)/settings/health/page';

const mockHealth = {
  overall: 'ok' as const,
  checkedAt: '2026-01-01T10:00:00Z',
  subsystems: [
    { name: 'postgres', status: 'ok' as const, latencyMs: 5, detail: undefined },
    { name: 'redis', status: 'degraded' as const, latencyMs: 120, detail: 'High latency' },
  ],
};

describe('SystemHealthPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders the page heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockHealth);
    render(<SystemHealthPage />);
    await waitFor(() => expect(screen.getByText(/system health/i)).toBeInTheDocument());
  });

  it('renders Refresh button', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockHealth);
    render(<SystemHealthPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument());
  });

  it('displays health data after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockHealth);
    render(<SystemHealthPage />);
    await waitFor(() => {
      expect(screen.getByText('postgres')).toBeInTheDocument();
      expect(screen.getByText('redis')).toBeInTheDocument();
    });
  });

  it('displays overall status', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockHealth);
    render(<SystemHealthPage />);
    await waitFor(() => {
      // Overall status badge shows "OK" (multiple ok badges may appear for subsystems)
      const okElements = screen.getAllByText('OK');
      expect(okElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls API again when Refresh clicked', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockHealth);
    render(<SystemHealthPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => expect(vi.mocked(adminRequest).mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
