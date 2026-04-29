import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntitlementsPanel } from '@/features/organizations/entitlements/entitlements-panel';
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
    entitlements: {
      title: 'Entitlements',
      description: 'Plan-derived access and organization overrides.',
      reason: 'Audit reason',
      reasonPlaceholder: 'Reason for changing entitlements',
      plan: 'Plan',
      override: 'Override',
      final: 'Final',
      enabled: 'Enabled',
      disabled: 'Disabled',
      none: 'None',
      source: 'Source',
      updated: 'Updated {date}',
      toggleLabel: 'Toggle {key}',
      empty: 'No entitlements found.',
      success: 'Entitlement updated.',
      errorFallback: 'Failed to update entitlement',
    },
  },
};

const entitlement = {
  id: 'flag-1',
  key: 'waitlist',
  nameAr: 'قائمة الانتظار',
  nameEn: 'Waitlist',
  descriptionAr: null,
  descriptionEn: 'Waitlist feature',
  allowedPlans: ['plan-pro'],
  limitKind: null,
  planDerivedEnabled: true,
  overrideEnabled: null,
  enabled: true,
  source: 'PLAN',
  overrideUpdatedAt: null,
};

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <EntitlementsPanel organizationId="org-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );

  return { invalidateSpy };
}

describe('EntitlementsPanel', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('lists organization entitlements', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);

    renderPanel();

    expect(await screen.findByText('Waitlist')).toBeInTheDocument();
    expect(screen.getByText('Plan-derived access and organization overrides.')).toBeInTheDocument();
    expect(adminRequest).toHaveBeenCalledWith('/feature-flags?organizationId=org-1');
  });

  it('requires an audit reason before toggling', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);
    renderPanel();

    const toggle = await screen.findByRole('switch', { name: 'Toggle waitlist' });
    expect(toggle).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Audit reason'), 'Disable for review');
    expect(toggle).toBeEnabled();
  });

  it('updates an override and invalidates entitlements plus audit log', async () => {
    vi.mocked(adminRequest).mockImplementation((path, init) => {
      if (init?.method === 'PATCH') return Promise.resolve({ ...entitlement, enabled: false });
      return Promise.resolve([entitlement]);
    });
    const { invalidateSpy } = renderPanel();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Audit reason'), 'Disable for review');
    await user.click(screen.getByRole('switch', { name: 'Toggle waitlist' }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/feature-flags/waitlist', {
        method: 'PATCH',
        body: JSON.stringify({
          organizationId: 'org-1',
          enabled: false,
          reason: 'Disable for review',
        }),
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['organizations', 'entitlements', 'org-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['audit-log', 'list'] });
  });
});
