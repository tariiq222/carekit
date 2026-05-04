import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:value`;
    return key;
  },
  useLocale: () => 'en',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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
import OrganizationsListPage from '@/app/(admin)/organizations/page';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, throwOnError: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><OrganizationsListPage /></QueryClientProvider>);
}

const mockData = {
  items: [
    {
      id: 'org-1',
      nameAr: 'عيادة الاختبار',
      nameEn: 'Test Clinic',
      slug: 'test-clinic',
      status: 'ACTIVE',
      isSuspended: false,
      suspendedAt: null,
      suspendedReason: null,
      verticalId: 'v-1',
      planId: 'plan-1',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
};

const mockDataMultiPage = {
  items: mockData.items,
  meta: { page: 1, perPage: 20, total: 40, totalPages: 2 },
};

describe('OrganizationsListPage', () => {
  beforeEach(() => vi.mocked(adminRequest).mockReset());

  it('renders Organizations heading', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('renders Create Tenant button', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    // Button text comes from t('create.button') which our mock returns as 'create.button'
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('renders filter bar', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows organizations after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('عيادة الاختبار')).toBeInTheDocument();
    });
  });

  it('renders organization slug after load', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('test-clinic')).toBeInTheDocument();
    });
  });

  it('shows pagination controls when multiple pages', async () => {
    vi.mocked(adminRequest).mockResolvedValue(mockDataMultiPage);
    renderPage();
    await waitFor(() => {
      // pagination.previous and pagination.next are rendered by t() returning the key
      expect(screen.getByText('pagination.previous')).toBeInTheDocument();
    });
    expect(screen.getByText('pagination.next')).toBeInTheDocument();
  });

  it('opens create tenant dialog on button click', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ items: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 1 } });
    renderPage();
    const user = userEvent.setup();
    const createBtn = screen.getByRole('button', { name: /create/i });
    await user.click(createBtn);
    // Dialog opens - CreateTenantDialog renders a modal
    await waitFor(() => {
      expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
    });
  });
});
