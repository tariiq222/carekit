import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { toast } from 'sonner';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { adminRequest } from '@/lib/api-client';
import { useDeleteVertical } from '@/features/verticals/delete-vertical/use-delete-vertical';
import { DeleteVerticalDialog } from '@/features/verticals/delete-vertical/delete-vertical-dialog';
import type { VerticalRow } from '@/features/verticals/types';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

const mockVertical: VerticalRow = {
  id: 'v-1',
  slug: 'dental',
  nameAr: 'أسنان',
  nameEn: 'Dental',
  templateFamily: 'MEDICAL',
  descriptionAr: null,
  descriptionEn: null,
  iconUrl: null,
  isActive: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
};

function renderDialog(open = true, onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DeleteVerticalDialog open={open} onOpenChange={onOpenChange} vertical={mockVertical} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('useDeleteVertical hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('sends DELETE to /verticals/:id with reason', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteVertical(), { wrapper: makeWrapper() });
    result.current.mutate({ verticalId: 'v-1', reason: 'Removing obsolete vertical' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/verticals/v-1', expect.objectContaining({ method: 'DELETE' }));
    expect(toast.success).toHaveBeenCalledWith('Vertical deleted.');
  });

  it('calls toast.error on failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('has_organizations'));
    const { result } = renderHook(() => useDeleteVertical(), { wrapper: makeWrapper() });
    result.current.mutate({ verticalId: 'v-1', reason: 'Trying to delete with organizations' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('has_organizations');
  });
});

describe('DeleteVerticalDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders vertical name in description', () => {
    renderDialog();
    expect(screen.getByText(/dental/i)).toBeInTheDocument();
  });

  it('Delete button is disabled with empty reason', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /delete vertical/i })).toBeDisabled();
  });

  it('Delete button is disabled with reason < 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'short');
    expect(screen.getByRole('button', { name: /delete vertical/i })).toBeDisabled();
  });

  it('Delete button enables with reason >= 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'Removing old vertical from system');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete vertical/i })).toBeEnabled();
    });
  });

  it('submits with correct verticalId and reason', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'Removing old vertical from system testing');
    await user.click(screen.getByRole('button', { name: /delete vertical/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('Cancel calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
