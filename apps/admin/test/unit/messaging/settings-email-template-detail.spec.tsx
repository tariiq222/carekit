import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import EmailTemplateEditorPage from '@/app/(admin)/settings/email/templates/[slug]/page';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'tenant-welcome' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/settings/email/templates/tenant-welcome',
  useSearchParams: () => new URLSearchParams(),
}));

const MOCK_TEMPLATE = {
  id: 'tpl-1', slug: 'tenant-welcome', name: 'Tenant Welcome',
  isActive: true, isLocked: false, version: 3,
  subjectAr: 'مرحباً بك في ديقه', subjectEn: 'Welcome to Deqah',
  htmlBody: '<p>Hello {{name}}</p>',
  blocks: null, updatedById: 'admin-1',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
};

const LOCKED_TEMPLATE = {
  ...MOCK_TEMPLATE,
  id: 'tpl-2', slug: 'billing-receipt', name: 'Billing Receipt', isLocked: true,
};

describe('EmailTemplateEditorPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmailTemplateEditorPage />);
    const pulse = container.querySelector('[class*="animate-pulse"]');
    expect(pulse).toBeTruthy();
  });

  it('shows error state when API fails', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Template not found'));
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Template not found')).toBeTruthy();
    });
  });

  it('shows generic error for unknown errors', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('network'));
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load template')).toBeTruthy();
    });
  });

  it('populates form fields after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATE);
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Tenant Welcome');
      expect(nameInput).toBeTruthy();
      expect(screen.getByDisplayValue('مرحباً بك في ديقه')).toBeTruthy();
      expect(screen.getByDisplayValue('Welcome to Deqah')).toBeTruthy();
      expect(screen.getByDisplayValue('<p>Hello {{name}}</p>')).toBeTruthy();
    });
  });

  it('shows template slug in header', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATE);
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      const slugElements = screen.getAllByText('tenant-welcome');
      expect(slugElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows template name in header', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATE);
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Tenant Welcome')).toBeTruthy();
    });
  });

  it('disables inputs for locked templates', async () => {
    vi.mocked(adminRequest).mockResolvedValue(LOCKED_TEMPLATE);
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      expect(screen.getByText('Locked — content read-only')).toBeTruthy();
    });
    const nameInput = screen.getByDisplayValue('Billing Receipt') as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
  });

  it('saves template with full body for unlocked template', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_TEMPLATE)  // getTemplate
      .mockResolvedValueOnce({ ...MOCK_TEMPLATE, version: 4 }); // updateTemplate
    const user = userEvent.setup();
    render(<EmailTemplateEditorPage />);
    await waitFor(() => screen.getByDisplayValue('Tenant Welcome'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByText('Saved successfully.')).toBeTruthy();
    });
    const calls = vi.mocked(adminRequest).mock.calls;
    const patchCall = calls.find(([url]) => (url as string).includes('PATCH') || (url as string).includes('tenant-welcome'));
    // second call should be PATCH
    const secondCall = calls[1];
    expect(secondCall).toBeTruthy();
    expect(secondCall![0]).toContain('/platform-email/templates/tenant-welcome');
    const opts = secondCall![1] as RequestInit;
    expect(opts.method).toBe('PATCH');
  });

  it('saves locked template with only isActive in body', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(LOCKED_TEMPLATE)
      .mockResolvedValueOnce(LOCKED_TEMPLATE);
    const user = userEvent.setup();
    render(<EmailTemplateEditorPage />);
    await waitFor(() => screen.getByDisplayValue('Billing Receipt'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByText('Saved successfully.')).toBeTruthy();
    });
    const calls = vi.mocked(adminRequest).mock.calls;
    const patchBody = JSON.parse((calls[1]![1] as RequestInit).body as string);
    // locked template — only isActive in body, no name/subject/body
    expect(patchBody).toHaveProperty('isActive');
    expect(patchBody).not.toHaveProperty('name');
    expect(patchBody).not.toHaveProperty('subjectAr');
    expect(patchBody).not.toHaveProperty('htmlBody');
  });

  it('shows error message when save fails', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_TEMPLATE)
      .mockRejectedValueOnce(new ApiError('Validation failed'));
    const user = userEvent.setup();
    render(<EmailTemplateEditorPage />);
    await waitFor(() => screen.getByDisplayValue('Tenant Welcome'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeTruthy();
    });
  });

  it('sends preview request on Preview button click', async () => {
    vi.mocked(adminRequest)
      .mockResolvedValueOnce(MOCK_TEMPLATE)
      .mockResolvedValueOnce({ subject: 'Welcome to Deqah', html: '<p>Hello</p>' });
    const user = userEvent.setup();
    render(<EmailTemplateEditorPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Preview' }));
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => {
      expect(screen.getByText(/Subject: Welcome to Deqah/)).toBeTruthy();
    });
  });

  it('shows the Active checkbox', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATE);
    render(<EmailTemplateEditorPage />);
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox', { name: /Active/i }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });
});
