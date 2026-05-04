import { renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { adminRequest } from '@/lib/api-client';
import { useArchiveOrganization } from '@/features/organizations/archive-organization/use-archive-organization';
import { ArchiveDialog } from '@/features/organizations/archive-organization/archive-dialog';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Hook uses useTranslations, so MESSAGES must be provided in the hook wrapper too

const MESSAGES = {
  organizations: {
    archive: {
      title: 'Archive organization',
      description: 'Archive {name} without deleting tenant data.',
      reason: 'Archive reason',
      cancel: 'Cancel',
      submit: 'Archive',
      submitting: 'Archiving...',
      success: 'Organization archived.',
      errorFallback: 'Failed to archive organization',
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

function renderDialog(overrides?: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  organizationId?: string;
  organizationName?: string;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      <QueryClientProvider client={qc}>
        <ArchiveDialog
          open={overrides?.open ?? true}
          onOpenChange={onOpenChange}
          organizationId={overrides?.organizationId ?? 'org-archive-1'}
          organizationName={overrides?.organizationName ?? 'Test Clinic'}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { onOpenChange, queryClient: qc };
}

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useArchiveOrganization hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('POSTs to /organizations/:id/archive with reason body', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useArchiveOrganization('org-1'), { wrapper });
    result.current.mutate('Closing due to non-payment issues');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(adminRequest).toHaveBeenCalledWith('/organizations/org-1/archive', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Closing due to non-payment issues' }),
    });
  });

  it('calls toast.success("Organization archived.") on success', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useArchiveOrganization('org-1'), { wrapper });
    result.current.mutate('Valid archive reason text');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Organization archived.');
  });

  it('invalidates organization detail and list queries on success', async () => {
    const { wrapper, invalidateSpy } = makeWrapper();
    vi.mocked(adminRequest).mockResolvedValue(undefined);

    const { result } = renderHook(() => useArchiveOrganization('org-inv'), { wrapper });
    result.current.mutate('Valid archive reason text');

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
    vi.mocked(adminRequest).mockRejectedValue(new Error('archive_conflict'));

    const { result } = renderHook(() => useArchiveOrganization('org-err'), { wrapper });
    result.current.mutate('Valid archive reason text');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('archive_conflict');
  });

  it('calls toast.error with fallback when error is not an Error instance', async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(adminRequest).mockRejectedValue('raw string');

    const { result } = renderHook(() => useArchiveOrganization('org-err'), { wrapper });
    result.current.mutate('Valid archive reason text');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Failed to archive organization');
  });
});

// ─── Dialog tests ─────────────────────────────────────────────────────────────

describe('ArchiveDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('submit button is disabled when reason is empty', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /archive/i })).toBeDisabled();
  });

  it('submit button is disabled when reason has 9 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/archive reason/i), '123456789');
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeDisabled();
  });

  it('submit button is enabled when reason has exactly 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/archive reason/i), '1234567890');
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeEnabled();
  });

  it('submit button is disabled when reason is 10 whitespace chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/archive reason/i), '          ');
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeDisabled();
  });

  it('submits with trimmed reason and closes dialog on success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/archive reason/i), 'Closing due to non-payment issues');
    await user.click(screen.getByRole('button', { name: /^archive$/i }));

    await waitFor(() => {
      expect(adminRequest).toHaveBeenCalledWith('/organizations/org-archive-1/archive', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Closing due to non-payment issues' }),
      });
    });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows error message inline on API failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('archive_blocked'));
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/archive reason/i), 'Valid archive reason here');
    await user.click(screen.getByRole('button', { name: /^archive$/i }));

    await waitFor(() => expect(screen.getByText('archive_blocked')).toBeInTheDocument());
  });

  it('does not close dialog on API error', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('error'));
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/archive reason/i), 'Valid archive reason here');
    await user.click(screen.getByRole('button', { name: /^archive$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
