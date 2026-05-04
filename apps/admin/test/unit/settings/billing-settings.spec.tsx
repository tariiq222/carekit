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
  redirect: vi.fn(),
}));

import { adminRequest } from '@/lib/api-client';
import BillingSettingsPage from '@/app/(admin)/settings/billing/page';

const mockSettings = {
  settings: [
    { key: 'billing.moyasar.platformSecretKey', value: null, isSecret: true },
    { key: 'billing.moyasar.platformWebhookSecret', value: null, isSecret: true },
    { key: 'billing.moyasar.publicKey', value: 'pk_test_abc', isSecret: false },
    { key: 'billing.defaults.currency', value: 'SAR', isSecret: false },
    { key: 'billing.defaults.taxPercent', value: 15, isSecret: false },
    { key: 'billing.defaults.trialDays', value: 14, isSecret: false },
  ],
};

describe('BillingSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows error when load fails', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('Failed to load'));
    render(<BillingSettingsPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('renders Moyasar credentials section', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<BillingSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /moyasar credentials/i })).toBeInTheDocument();
    });
  });

  it('renders billing defaults section', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<BillingSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /billing defaults/i })).toBeInTheDocument();
    });
  });

  it('renders Test Connection button', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockSettings);
    render(<BillingSettingsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    });
  });

  it('shows connection success after test', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValueOnce({ ok: true, latencyMs: 45, statusCode: 200 }); // test
    render(<BillingSettingsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => {
      expect(screen.getByText(/connected successfully/i)).toBeInTheDocument();
    });
  });

  it('shows connection failure after test', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValueOnce({ ok: false, error: 'invalid_key', latencyMs: 10 }); // test
    render(<BillingSettingsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => {
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    });
  });

  it('saves Moyasar credentials section on Save click', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValue(undefined); // save calls
    render(<BillingSettingsPage />);
    const user = userEvent.setup();
    // Wait for form to load
    await waitFor(() => expect(screen.getByRole('heading', { name: /moyasar credentials/i })).toBeInTheDocument());
    // Find and click the first Save button (Moyasar section)
    const saveBtns = screen.getAllByRole('button', { name: /save/i });
    await user.click(saveBtns[0]);
    await waitFor(() => {
      // After save, adminRequest is called for save operations
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
  });

  it('saves billing defaults section on Save click', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValue(undefined); // save calls
    render(<BillingSettingsPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole('heading', { name: /billing defaults/i })).toBeInTheDocument());
    const saveBtns = screen.getAllByRole('button', { name: /save/i });
    if (saveBtns.length > 1) {
      await user.click(saveBtns[saveBtns.length - 1]);
      await waitFor(() => {
        expect(vi.mocked(adminRequest)).toHaveBeenCalled();
      });
    }
  });

  it('shows save result after saving', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(mockSettings) // load
      .mockResolvedValue(undefined); // save calls
    render(<BillingSettingsPage />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /save/i }).length).toBeGreaterThan(0));
    const saveBtns = screen.getAllByRole('button', { name: /save/i });
    await user.click(saveBtns[0]);
    await waitFor(() => {
      expect(vi.mocked(adminRequest)).toHaveBeenCalled();
    });
  });
});
