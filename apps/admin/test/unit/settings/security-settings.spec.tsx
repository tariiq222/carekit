import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  redirect: vi.fn(),
}));

const stableT = (key: string) => key;
vi.mock('next-intl', () => ({ useTranslations: () => stableT }));

import { adminRequest } from '@/lib/api-client';
import SecuritySettingsPage from '@/app/(admin)/settings/security/page';

const mockSettings = {
  sessionTtlMinutes: 60,
  require2fa: false,
  ipAllowlist: ['192.168.1.0/24'],
};

describe('SecuritySettingsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows loading state initially', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { container } = render(<SecuritySettingsPage />);
    const pulsingEls = container.querySelectorAll('[class*="animate-pulse"]');
    expect(pulsingEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error when load fails and data is null', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Load failed'));
    render(<SecuritySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Load failed')).toBeInTheDocument();
    });
  });

  it('renders settings fields after loading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<SecuritySettingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/sessionttl.title/i)).toBeInTheDocument();
    });
  });

  it('renders 2FA checkbox', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<SecuritySettingsPage />);
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /twofactor.label/i });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });

  it('renders IP allowlist textarea with loaded values', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<SecuritySettingsPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue(/192\.168\.1\.0\/24/)).toBeInTheDocument();
    });
  });

  it('shows success message after saving', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValueOnce(undefined); // save
    render(<SecuritySettingsPage />);
    // Wait for the page to load (save button appears)
    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
    // Find the save button (a <button> element rendered at the bottom)
    const buttons = screen.getAllByRole('button');
    const saveBtn = buttons[buttons.length - 1]; // last button is the save button
    const user = userEvent.setup();
    await user.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/savesuccess/i)).toBeInTheDocument();
    });
  });
});
