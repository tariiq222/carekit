import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useChangePlan } from '@/features/organizations/change-plan/use-change-plan';
import { ChangePlanDialog } from '@/features/organizations/change-plan/change-plan-dialog';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/features/plans/list-plans/use-list-plans', () => ({
  useListPlans: () => ({
    data: [
      { id: 'plan-basic', slug: 'basic', nameEn: 'Basic', nameAr: 'الأساسية', isActive: true },
      { id: 'plan-pro', slug: 'pro', nameEn: 'Pro', nameAr: 'الاحترافية', isActive: true },
      { id: 'plan-inactive', slug: 'inactive', nameEn: 'Old', nameAr: 'قديم', isActive: false },
    ],
  }),
}));

const MESSAGES = { organizations: { update: {}, archive: {}, create: {} } };

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient, invalidateSpy };
}

function renderDialog(overrides?: {
  orgId?: string;
  currentPlanId?: string;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={qc}>
        <ChangePlanDialog
          orgId={overrides?.orgId ?? 'org-cp-1'}
          currentPlanId={overrides?.currentPlanId ?? 'plan-basic'}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useChangePlan hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('PATCHes to /billing/subscriptions/:orgId/plan with body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });

    const { result } = renderHook(() => useChangePlan('org-1'), { wrapper });
    result.current.mutate({ newPlanId: 'plan-pro', reason: 'Upgrading to pro plan for more features' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/billing/subscriptions/org-1/plan', {
      method: 'PATCH',
      body: JSON.stringify({ newPlanId: 'plan-pro', reason: 'Upgrading to pro plan for more features' }),
    });
  });

  it('invalidates org-billing query on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });

    const { result } = renderHook(() => useChangePlan('org-inv'), { wrapper });
    result.current.mutate({ newPlanId: 'plan-pro', reason: 'Upgrading to pro plan for more features' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['org-billing', 'org-inv'] }),
    );
  });

  it('does not call toast.success (no toast in this hook)', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });

    const { result } = renderHook(() => useChangePlan('org-1'), { wrapper });
    result.current.mutate({ newPlanId: 'plan-pro', reason: 'Testing toast behavior here' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('ChangePlanDialog (org-page version)', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  async function openDialog(overrides?: { orgId?: string; currentPlanId?: string }) {
    renderDialog(overrides);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /change plan/i }));
    return { user };
  }

  it('opens the dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByText(/change subscription plan/i)).toBeInTheDocument();
  });

  it('confirm button is disabled when no plan is selected', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
  });

  it('confirm button is disabled when selected plan equals current plan', async () => {
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });
    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-basic');
    await user.type(screen.getByLabelText(/reason/i), 'Sufficient reason here');
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
  });

  it('confirm button is disabled when reason has fewer than 10 chars', async () => {
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });
    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-pro');
    await user.type(screen.getByLabelText(/reason/i), 'short');
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
  });

  it('confirm button is disabled with 10 whitespace chars for reason', async () => {
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });
    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-pro');
    await user.type(screen.getByLabelText(/reason/i), '          ');
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeDisabled();
  });

  it('confirm button is enabled when different plan selected and reason >= 10 chars', async () => {
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });
    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-pro');
    await user.type(screen.getByLabelText(/reason/i), 'Upgrading for more capacity');
    expect(screen.getByRole('button', { name: /confirm change/i })).toBeEnabled();
  });

  it('calls adminRequest with correct body on confirm', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });

    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-pro');
    await user.type(screen.getByLabelText(/reason/i), 'Upgrading for more capacity');
    await user.click(screen.getByRole('button', { name: /confirm change/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/billing/subscriptions/org-cp-1/plan', {
        method: 'PATCH',
        body: JSON.stringify({ newPlanId: 'plan-pro', reason: 'Upgrading for more capacity' }),
      });
    });
  });

  it('only shows active plans in the select', async () => {
    await openDialog();
    expect(screen.queryByText(/old/i)).not.toBeInTheDocument();
    expect(screen.getByText(/basic/i)).toBeInTheDocument();
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });

  it('dialog closes after successful plan change (onSuccess fires)', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'sub-1' });
    const { user } = await openDialog({ currentPlanId: 'plan-basic' });

    await user.selectOptions(screen.getByLabelText(/new plan/i), 'plan-pro');
    await user.type(screen.getByLabelText(/reason/i), 'Upgrading for more capacity');
    await user.click(screen.getByRole('button', { name: /confirm change/i }));

    await waitFor(() => {
      expect(screen.queryByText(/change subscription plan/i)).not.toBeInTheDocument();
    });
  });

  it('Cancel button closes the dialog', async () => {
    const { user } = await openDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText(/change subscription plan/i)).not.toBeInTheDocument(),
    );
  });
});
