import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { adminRequest } from '@/lib/api-client';
import { useCreateTenant } from '@/features/organizations/create-tenant/use-create-tenant';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MESSAGES = {
  organizations: {
    create: {
      success: 'Tenant created.',
      errorFallback: 'Failed to create tenant',
    },
  },
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      NextIntlClientProvider,
      { locale: 'en', messages: MESSAGES },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
  return { wrapper, queryClient, invalidateSpy };
}

const MOCK_ORG = {
  id: 'org-new-1',
  slug: 'new-clinic',
  nameAr: 'عيادة جديدة',
  nameEn: 'New Clinic',
  status: 'TRIALING',
  verticalId: null,
  trialEndsAt: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: '2026-05-01T00:00:00Z',
  subscription: null,
};

describe('useCreateTenant hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /organizations with tenant command body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG);

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({
      slug: 'new-clinic',
      nameAr: 'عيادة جديدة',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'new-clinic',
        nameAr: 'عيادة جديدة',
        ownerUserId: '11111111-1111-4111-8111-111111111111',
      }),
    });
  });

  it('calls toast.success("Tenant created.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG);

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({ slug: 'new-clinic', nameAr: 'عيادة جديدة' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Tenant created.');
  });

  it('invalidates ["organizations", "list"] query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG);

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({ slug: 'new-clinic', nameAr: 'عيادة جديدة' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['organizations', 'list'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('slug_taken'));

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({ slug: 'taken-slug', nameAr: 'عيادة' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('slug_taken');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('non-error');

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({ slug: 'some-slug', nameAr: 'عيادة' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to create tenant');
  });

  it('supports all optional command fields', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(MOCK_ORG);

    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    result.current.mutate({
      slug: 'full-clinic',
      nameAr: 'عيادة كاملة',
      nameEn: 'Full Clinic',
      ownerName: 'Dr. Ahmed',
      ownerEmail: 'ahmed@example.com',
      ownerPhone: '+966501234567',
      verticalSlug: 'general',
      planId: 'plan-basic',
      billingCycle: 'MONTHLY',
      trialDays: 14,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'full-clinic',
        nameAr: 'عيادة كاملة',
        nameEn: 'Full Clinic',
        ownerName: 'Dr. Ahmed',
        ownerEmail: 'ahmed@example.com',
        ownerPhone: '+966501234567',
        verticalSlug: 'general',
        planId: 'plan-basic',
        billingCycle: 'MONTHLY',
        trialDays: 14,
      }),
    });
  });
});
