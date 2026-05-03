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

vi.mock('@deqah/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deqah/shared')>();
  return {
    ...actual,
    FEATURE_CATALOG: {
      waitlist: {
        key: 'waitlist',
        kind: 'boolean',
        tier: 'PRO',
        group: 'Booking & Scheduling',
        nameAr: 'قائمة الانتظار',
        nameEn: 'Waitlist',
        descAr: 'إدارة قائمة عملاء بانتظار شواغر في الجدول',
        descEn: 'Manage a queue of clients waiting for openings',
      },
    },
  };
});

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
  source: 'PLAN' as const,
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

// Radix UI Select requires pointer capture and scroll APIs not available in jsdom.
// Polyfill them globally so that SelectContent opens in tests.
beforeEach(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

describe('EntitlementsPanel', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('lists organization entitlements', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);

    renderPanel();

    expect(await screen.findByText('Waitlist')).toBeInTheDocument();
    expect(
      screen.getByText('Override plan defaults for this organization. Changes take effect immediately.'),
    ).toBeInTheDocument();
    expect(adminRequest).toHaveBeenCalledWith('/feature-flags?organizationId=org-1');
  });

  it('Save button is disabled when no changes are pending', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);

    renderPanel();

    await screen.findByText('Waitlist');

    const saveButton = screen.getByRole('button', { name: /save 0 changes/i });
    expect(saveButton).toBeDisabled();
  });

  it('opens confirmation dialog when Save is clicked after a change', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);

    renderPanel();
    const user = userEvent.setup();

    await screen.findByText('Waitlist');

    // Change the override select from INHERIT to FORCE_OFF
    const overrideSelect = screen.getByRole('combobox');
    await user.click(overrideSelect);
    await user.click(await screen.findByRole('option', { name: 'Force OFF' }));

    const saveButton = screen.getByRole('button', { name: /save 1 change/i });
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    // Confirmation dialog should open
    expect(await screen.findByText('Save entitlement overrides')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });

  it('Confirm button requires a reason of at least 10 characters', async () => {
    vi.mocked(adminRequest).mockResolvedValue([entitlement]);

    renderPanel();
    const user = userEvent.setup();

    await screen.findByText('Waitlist');

    // Change override and open dialog
    const overrideSelect = screen.getByRole('combobox');
    await user.click(overrideSelect);
    await user.click(await screen.findByRole('option', { name: 'Force OFF' }));
    await user.click(screen.getByRole('button', { name: /save 1 change/i }));

    const confirmButton = await screen.findByRole('button', { name: 'Confirm' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Reason'), 'Short');
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Reason'), ' enough reason here');
    expect(confirmButton).toBeEnabled();
  });

  it('calls upsertOverride API and invalidates queries on confirm', async () => {
    vi.mocked(adminRequest).mockImplementation((path, init) => {
      if (init?.method === 'PUT') return Promise.resolve({ success: true });
      return Promise.resolve([entitlement]);
    });

    const { invalidateSpy } = renderPanel();
    const user = userEvent.setup();

    await screen.findByText('Waitlist');

    // Change override and open dialog
    const overrideSelect = screen.getByRole('combobox');
    await user.click(overrideSelect);
    await user.click(await screen.findByRole('option', { name: 'Force OFF' }));
    await user.click(screen.getByRole('button', { name: /save 1 change/i }));

    await user.type(await screen.findByLabelText('Reason'), 'Disabling for compliance review');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/feature-flags/override', {
        method: 'PUT',
        body: JSON.stringify({
          organizationId: 'org-1',
          key: 'waitlist',
          mode: 'FORCE_OFF',
          reason: 'Disabling for compliance review',
        }),
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['admin', 'org', 'org-1', 'entitlements'],
    });
  });
});
