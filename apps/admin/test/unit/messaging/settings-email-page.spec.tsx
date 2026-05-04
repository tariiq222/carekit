import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import EmailSettingsPage from '@/app/(admin)/settings/email/page';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('EmailSettingsPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders the page heading', () => {
    render(<EmailSettingsPage />);
    expect(screen.getByText('Email Settings')).toBeTruthy();
  });

  it('renders the test send form', () => {
    render(<EmailSettingsPage />);
    expect(screen.getByLabelText('Template Slug')).toBeTruthy();
    expect(screen.getByLabelText('Recipient Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send test email' })).toBeTruthy();
  });

  it('renders links to templates and logs', () => {
    render(<EmailSettingsPage />);
    const allLinks = screen.getAllByRole('link');
    const hrefs = allLinks.map((l) => (l as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toContain('/settings/email/templates');
    expect(hrefs).toContain('/settings/email/logs');
  });

  it('shows Sending... on the submit button while in flight', async () => {
    let resolve!: (v: { ok: boolean }) => void;
    vi.mocked(adminRequest).mockReturnValue(new Promise((r) => { resolve = r; }));
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'welcome-email');
    await user.type(screen.getByLabelText('Recipient Email'), 'admin@deqah.app');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeTruthy();
    resolve({ ok: true });
  });

  it('shows success message after successful test send', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'tenant-welcome');
    await user.type(screen.getByLabelText('Recipient Email'), 'test@clinic.sa');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => {
      expect(screen.getByText('Email sent successfully.')).toBeTruthy();
    });
  });

  it('shows failure message when test send returns ok:false', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ok: false, reason: 'No API key configured' });
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'billing-receipt');
    await user.type(screen.getByLabelText('Recipient Email'), 'owner@clinic.sa');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => {
      expect(screen.getByText(/Failed: No API key configured/)).toBeTruthy();
    });
  });

  it('shows failure message on thrown API error', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Resend unreachable'));
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'tenant-welcome');
    await user.type(screen.getByLabelText('Recipient Email'), 'owner@clinic.sa');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => {
      expect(screen.getByText(/Failed: Resend unreachable/)).toBeTruthy();
    });
  });

  it('shows failure message on unexpected error', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'tenant-welcome');
    await user.type(screen.getByLabelText('Recipient Email'), 'owner@clinic.sa');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => {
      expect(screen.getByText(/Failed: Unexpected error/)).toBeTruthy();
    });
  });

  it('calls testSend with slug and to from form inputs', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EmailSettingsPage />);
    await user.type(screen.getByLabelText('Template Slug'), 'billing-receipt');
    await user.type(screen.getByLabelText('Recipient Email'), 'finance@clinic.sa');
    await user.click(screen.getByRole('button', { name: 'Send test email' }));
    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        '/platform-email/test-send',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ slug: 'billing-receipt', to: 'finance@clinic.sa' }),
        }),
      );
    });
  });
});
