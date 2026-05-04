import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { toast } from 'sonner';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
import { useUpdateVertical } from '@/features/verticals/update-vertical/use-update-vertical';
import { UpdateVerticalDialog } from '@/features/verticals/update-vertical/update-vertical-dialog';
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
      <UpdateVerticalDialog open={open} onOpenChange={onOpenChange} vertical={mockVertical} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('useUpdateVertical hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('patches /verticals/:id with correct body', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'v-1' });
    const { result } = renderHook(() => useUpdateVertical(), { wrapper: makeWrapper() });
    result.current.mutate({ verticalId: 'v-1', nameAr: 'أسنان جديد', nameEn: 'Dental New', templateFamily: 'MEDICAL', reason: 'Update dental vertical test' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/verticals/v-1', expect.objectContaining({ method: 'PATCH' }));
    expect(toast.success).toHaveBeenCalledWith('Vertical updated.');
  });

  it('calls toast.error on failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('not_found'));
    const { result } = renderHook(() => useUpdateVertical(), { wrapper: makeWrapper() });
    result.current.mutate({ verticalId: 'v-none', nameEn: 'X', nameAr: 'ع', templateFamily: 'MEDICAL', reason: 'Update vertical test' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('not_found');
  });
});

describe('UpdateVerticalDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
  });

  it('renders dialog header with slug', () => {
    renderDialog();
    expect(screen.getByText(/edit vertical/i)).toBeInTheDocument();
    expect(screen.getByText(/dental/i)).toBeInTheDocument();
  });

  it('pre-fills fields with vertical data', () => {
    renderDialog();
    expect(screen.getByDisplayValue('أسنان')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dental')).toBeInTheDocument();
  });

  it('Save button is disabled with empty reason', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('Save button enables with valid reason', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/reason/i), 'Updating dental vertical with 10+ chars');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
    });
  });

  it('Cancel calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render form when open=false', () => {
    renderDialog(false);
    expect(screen.queryByLabelText(/reason/i)).not.toBeInTheDocument();
  });
});
