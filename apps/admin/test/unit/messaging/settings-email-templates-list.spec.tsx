import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminRequest } from '@/lib/api-client';
import EmailTemplatesListPage from '@/app/(admin)/settings/email/templates/page';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(message: string) { super(message); this.name = 'ApiError'; }
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const MOCK_TEMPLATES = [
  {
    id: 'tpl-1', slug: 'tenant-welcome', name: 'Tenant Welcome',
    isActive: true, isLocked: false, version: 2, updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'tpl-2', slug: 'billing-receipt', name: 'Billing Receipt',
    isActive: true, isLocked: true, version: 1, updatedAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 'tpl-3', slug: 'subscription-cancelled', name: 'Subscription Cancelled',
    isActive: false, isLocked: false, version: 1, updatedAt: '2026-04-01T00:00:00Z',
  },
];

describe('EmailTemplatesListPage', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('shows loading skeleton while fetching', () => {
    vi.mocked(adminRequest).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EmailTemplatesListPage />);
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state when API fails', async () => {
    const { ApiError } = await import('@/lib/api-client');
    vi.mocked(adminRequest).mockRejectedValue(new ApiError('Failed to fetch templates'));
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch templates')).toBeTruthy();
    });
  });

  it('shows generic error when non-ApiError thrown', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('network'));
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load templates')).toBeTruthy();
    });
  });

  it('shows empty state when no templates returned', async () => {
    vi.mocked(adminRequest).mockResolvedValue([]);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('No platform email templates found.')).toBeTruthy();
    });
  });

  it('renders all templates after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('Tenant Welcome')).toBeTruthy();
      expect(screen.getByText('Billing Receipt')).toBeTruthy();
      expect(screen.getByText('Subscription Cancelled')).toBeTruthy();
    });
  });

  it('renders template slugs', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('tenant-welcome')).toBeTruthy();
      expect(screen.getByText('billing-receipt')).toBeTruthy();
    });
  });

  it('shows Locked badge for locked templates', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('Locked')).toBeTruthy();
    });
  });

  it('shows Active badge for active templates', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows Inactive badge for inactive templates', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeTruthy();
    });
  });

  it('links each template to its detail page', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      const links = screen.getAllByRole('link');
      const hrefs = links.map((l) => (l as HTMLAnchorElement).getAttribute('href'));
      expect(hrefs).toContain('/settings/email/templates/tenant-welcome');
      expect(hrefs).toContain('/settings/email/templates/billing-receipt');
    });
  });

  it('shows version number for each template', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText('v2')).toBeTruthy();
    });
  });

  it('shows template count in heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue(MOCK_TEMPLATES);
    render(<EmailTemplatesListPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 templates registered/)).toBeTruthy();
    });
  });
});
