import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTenantDialog } from '@/features/organizations/create-tenant/create-tenant-dialog';
import { adminRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  adminRequest: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const messages = {
  organizations: {
    create: {
      button: 'Create tenant',
      title: 'Create tenant',
      description: 'Create an organization, owner membership, tenant defaults, and audit entry.',
      slug: 'Slug',
      slugPlaceholder: 'riyadh-clinic',
      nameAr: 'Arabic name',
      nameEn: 'English name',
      ownerUserId: 'Owner user ID',
      verticalSlug: 'Vertical slug',
      planId: 'Plan ID',
      billingCycle: 'Billing cycle',
      monthly: 'Monthly',
      annual: 'Annual',
      trialDays: 'Trial days',
      reason: 'Audit reason',
      cancel: 'Cancel',
      submit: 'Create tenant',
      submitting: 'Creating...',
      success: 'Tenant created.',
      errorFallback: 'Failed to create tenant',
    },
  },
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  const onOpenChange = vi.fn();

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <CreateTenantDialog open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );

  return { invalidateSpy, onOpenChange };
}

describe('CreateTenantDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('keeps submit disabled until the required audit-safe fields are valid', async () => {
    renderDialog();
    const user = userEvent.setup();
    const submit = screen.getByRole('button', { name: 'Create tenant' });

    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Slug'), 'riyadh-clinic');
    await user.type(screen.getByLabelText('Arabic name'), 'عيادة الرياض');
    await user.type(screen.getByLabelText('Owner user ID'), '11111111-1111-4111-8111-111111111111');
    await user.type(screen.getByLabelText('Audit reason'), 'Create tenant for onboarding');

    expect(submit).toBeEnabled();
  });

  it('posts a clean create payload and refreshes organization lists', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      id: 'org-1',
      slug: 'riyadh-clinic',
      nameAr: 'عيادة الرياض',
      nameEn: 'Riyadh Clinic',
      status: 'TRIALING',
      verticalId: 'vertical-1',
      trialEndsAt: null,
    });
    const { invalidateSpy, onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Slug'), '  riyadh-clinic  ');
    await user.type(screen.getByLabelText('Arabic name'), '  عيادة الرياض  ');
    await user.type(screen.getByLabelText('English name'), '  Riyadh Clinic  ');
    await user.type(screen.getByLabelText('Owner user ID'), '11111111-1111-4111-8111-111111111111');
    await user.type(screen.getByLabelText('Vertical slug'), ' medical ');
    await user.type(screen.getByLabelText('Plan ID'), '22222222-2222-4222-8222-222222222222');
    await user.clear(screen.getByLabelText('Trial days'));
    await user.type(screen.getByLabelText('Trial days'), '21');
    await user.type(screen.getByLabelText('Audit reason'), 'Create tenant for onboarding');
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'riyadh-clinic',
          nameAr: 'عيادة الرياض',
          nameEn: 'Riyadh Clinic',
          ownerUserId: '11111111-1111-4111-8111-111111111111',
          verticalSlug: 'medical',
          planId: '22222222-2222-4222-8222-222222222222',
          billingCycle: 'MONTHLY',
          trialDays: 21,
          reason: 'Create tenant for onboarding',
        }),
      });
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['organizations', 'list'] });
  });

  it('keeps the dialog open and renders API errors', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('owner_user_not_found'));
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Slug'), 'riyadh-clinic');
    await user.type(screen.getByLabelText('Arabic name'), 'عيادة الرياض');
    await user.type(screen.getByLabelText('Owner user ID'), '11111111-1111-4111-8111-111111111111');
    await user.type(screen.getByLabelText('Audit reason'), 'Create tenant for onboarding');
    await user.click(screen.getByRole('button', { name: 'Create tenant' }));

    expect(await screen.findByText('owner_user_not_found')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
