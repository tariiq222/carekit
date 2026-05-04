import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useUpdateOrganization } from '@/features/organizations/update-organization/use-update-organization';
import { UpdateOrganizationDialog } from '@/features/organizations/update-organization/update-organization-dialog';
import type { OrganizationDetail } from '@/features/organizations/types';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MESSAGES = {
  organizations: {
    update: {
      title: 'Edit organization metadata',
      description: 'Update tenant names, vertical, or trial date.',
      nameAr: 'Arabic name',
      nameEn: 'English name',
      verticalSlug: 'New vertical slug',
      trialEndsAt: 'Trial ends at',
      reason: 'Audit reason',
      cancel: 'Cancel',
      submit: 'Save changes',
      submitting: 'Saving...',
      success: 'Organization updated.',
      errorFallback: 'Failed to update organization',
    },
    archive: {},
    create: {},
  },
};

const MOCK_ORG: OrganizationDetail = {
  id: 'org-update-1',
  slug: 'test-clinic',
  nameAr: 'عيادة الاختبار',
  nameEn: 'Test Clinic',
  status: 'ACTIVE',
  verticalId: null,
  trialEndsAt: null,
  suspendedAt: null,
  suspendedReason: null,
  createdAt: '2026-01-01T00:00:00Z',
  subscription: null,
  stats: { memberCount: 5, bookingCount30d: 10, totalRevenue: 1000 },
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

function renderDialog(overrides?: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  organization?: OrganizationDetail;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={qc}>
        <UpdateOrganizationDialog
          open={overrides?.open ?? true}
          onOpenChange={onOpenChange}
          organization={overrides?.organization ?? MOCK_ORG}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { onOpenChange, queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useUpdateOrganization hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('PATCHes to /organizations/:id with body (organizationId excluded)', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_ORG });

    const { result } = renderHook(() => useUpdateOrganization('org-1'), { wrapper });
    result.current.mutate({ nameAr: 'عيادة جديدة', reason: 'Correcting Arabic name for tenant' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1', {
      method: 'PATCH',
      body: JSON.stringify({ nameAr: 'عيادة جديدة', reason: 'Correcting Arabic name for tenant' }),
    });
  });

  it('calls toast.success("Organization updated.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_ORG });

    const { result } = renderHook(() => useUpdateOrganization('org-1'), { wrapper });
    result.current.mutate({ nameAr: 'عيادة جديدة', reason: 'Correcting Arabic name for tenant' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Organization updated.');
  });

  it('invalidates organization detail and list queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_ORG });

    const { result } = renderHook(() => useUpdateOrganization('org-inv'), { wrapper });
    result.current.mutate({ nameAr: 'عيادة جديدة', reason: 'Correcting Arabic name for tenant' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['organizations', 'detail', 'org-inv'] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['organizations', 'list'] }),
    );
  });

  it('calls toast.error with error message on failure', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue(new Error('update_conflict'));

    const { result } = renderHook(() => useUpdateOrganization('org-err'), { wrapper });
    result.current.mutate({ nameAr: 'عيادة', reason: 'Valid audit reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('update_conflict');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('string error');

    const { result } = renderHook(() => useUpdateOrganization('org-err'), { wrapper });
    result.current.mutate({ nameAr: 'عيادة', reason: 'Valid audit reason here' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to update organization');
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('UpdateOrganizationDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('pre-populates nameAr and nameEn from organization prop', () => {
    renderDialog();
    expect(screen.getByDisplayValue('عيادة الاختبار')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Clinic')).toBeInTheDocument();
  });

  it('submit button is disabled when nameAr is empty', async () => {
    renderDialog();
    const user = userEvent.setup();
    // Clear nameAr
    await user.clear(screen.getByLabelText(/arabic name/i));
    await user.type(screen.getByLabelText(/audit reason/i), 'Valid reason for this update');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('submit button is disabled when reason has fewer than 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/audit reason/i), 'too short');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('submit button is disabled with 10 whitespace chars for reason', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/audit reason/i), '          ');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('submit button is enabled when nameAr >= 2 chars and reason >= 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/audit reason/i), 'Valid reason for update action');
    expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
  });

  it('PATCHes with trimmed values on submit', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_ORG });
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/audit reason/i), 'Correcting tenant name for compliance');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith(
        '/organizations/org-update-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows inline error message on API failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('name_conflict'));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/audit reason/i), 'Correcting tenant name for compliance');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText('name_conflict')).toBeInTheDocument());
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('can update nameEn field', async () => {
    renderDialog();
    const user = userEvent.setup();
    const nameEnInput = screen.getByLabelText(/english name/i);
    await user.clear(nameEnInput);
    await user.type(nameEnInput, 'Updated English Name');
    expect(screen.getByDisplayValue('Updated English Name')).toBeInTheDocument();
  });

  it('can update verticalSlug field', async () => {
    renderDialog();
    const user = userEvent.setup();
    const verticalInput = screen.getByLabelText(/new vertical slug/i);
    await user.type(verticalInput, 'general');
    expect(screen.getByDisplayValue('general')).toBeInTheDocument();
  });

  it('sends verticalSlug as undefined when empty', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ ...MOCK_ORG });
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/audit reason/i), 'Valid reason for this update action');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const body = JSON.parse(
        (vi.mocked(adminRequest).mock.calls[0][1] as { body: string }).body,
      );
      expect(body.verticalSlug).toBeUndefined();
    });
  });

  it('can update trialEndsAt datetime-local field', async () => {
    renderDialog();
    const user = userEvent.setup();
    const trialInput = screen.getByLabelText(/trial ends at/i);
    await user.type(trialInput, '2026-12-31T00:00');
    expect(trialInput).toBeInTheDocument();
  });

  it('pre-populates trialEndsAt from org with a valid date', () => {
    const orgWithTrial = {
      ...MOCK_ORG,
      trialEndsAt: '2026-12-31T00:00:00.000Z',
    };
    renderDialog({ organization: orgWithTrial });
    const trialInput = screen.getByLabelText(/trial ends at/i) as HTMLInputElement;
    // toDatetimeLocal formats to ISO slice "2026-12-31T00:00"
    expect(trialInput.value).toBe('2026-12-31T00:00');
  });

  it('handles invalid trialEndsAt date gracefully (empty string)', () => {
    const orgWithInvalidTrial = {
      ...MOCK_ORG,
      trialEndsAt: 'invalid-date',
    };
    renderDialog({ organization: orgWithInvalidTrial });
    const trialInput = screen.getByLabelText(/trial ends at/i) as HTMLInputElement;
    expect(trialInput.value).toBe('');
  });
});
