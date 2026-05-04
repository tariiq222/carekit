import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('@deqah/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/api-client')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    ApiError: actual.ApiError,
  };
});

describe('create-tenant.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls adminRequest with POST and correct URL', async () => {
    const { createTenant } = await import('@/features/organizations/create-tenant/create-tenant.api');
    mockApiRequest.mockResolvedValue({ id: 'new-org' });

    await createTenant({ slug: 'new-clinic', nameAr: 'عيادة جديدة', ownerEmail: 'owner@clinic.com' });

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({ slug: 'new-clinic', nameAr: 'عيادة جديدة', ownerEmail: 'owner@clinic.com' }),
    });
  });

  it('serializes all command fields to JSON body', async () => {
    const { createTenant } = await import('@/features/organizations/create-tenant/create-tenant.api');
    mockApiRequest.mockResolvedValue({ id: '1' });

    await createTenant({
      slug: 'acme',
      nameAr: 'شركة',
      nameEn: 'Acme',
      ownerUserId: 'u-1',
      verticalSlug: 'medical',
      planId: 'plan-pro',
      billingCycle: 'ANNUAL',
      trialDays: 14,
    });

    const call = mockApiRequest.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.slug).toBe('acme');
    expect(body.billingCycle).toBe('ANNUAL');
    expect(body.trialDays).toBe(14);
  });

  it('returns typed OrganizationRow', async () => {
    const { createTenant } = await import('@/features/organizations/create-tenant/create-tenant.api');
    const mockRow = { id: 'org-new', slug: 'new-clinic', nameAr: 'new', nameEn: 'New' };
    mockApiRequest.mockResolvedValue(mockRow);

    const result = await createTenant({ slug: 'nc', nameAr: 'n' });

    expect(result.id).toBe('org-new');
  });
});
