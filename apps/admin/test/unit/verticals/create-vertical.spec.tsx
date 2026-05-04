import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { toast } from 'sonner';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Polyfills for jsdom Radix Select
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
import { useCreateVertical } from '@/features/verticals/create-vertical/use-create-vertical';
import { CreateVerticalDialog } from '@/features/verticals/create-vertical/create-vertical-dialog';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function renderDialog(open = true, onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CreateVerticalDialog open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

describe('useCreateVertical hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /verticals with correct body', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ id: 'v-new' });
    const { result } = renderHook(() => useCreateVertical(), { wrapper: makeWrapper() });

    result.current.mutate({
      slug: 'dental',
      nameAr: 'أسنان',
      nameEn: 'Dental',
      templateFamily: 'MEDICAL',
      reason: 'Creating dental vertical for clinic',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/verticals', expect.objectContaining({ method: 'POST' }));
    expect(toast.success).toHaveBeenCalledWith('Vertical created.');
  });

  it('calls toast.error on failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('already_exists'));
    const { result } = renderHook(() => useCreateVertical(), { wrapper: makeWrapper() });
    result.current.mutate({ slug: 'dental', nameAr: 'أسنان', nameEn: 'Dental', templateFamily: 'MEDICAL', reason: 'Creating dental vertical' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('already_exists');
  });
});

describe('CreateVerticalDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('renders dialog when open=true', () => {
    renderDialog();
    expect(screen.getByRole('heading', { name: /create vertical/i })).toBeInTheDocument();
  });

  it('submit button is disabled with empty form', () => {
    renderDialog();
    const btn = screen.getByRole('button', { name: /create vertical/i });
    expect(btn).toBeDisabled();
  });

  it('submit button enables when all required fields filled', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/slug/i), 'dental');
    await user.type(screen.getByLabelText(/name \(arabic\)/i), 'أسنان');
    await user.type(screen.getByLabelText(/name \(english\)/i), 'Dental');
    await user.type(screen.getByLabelText(/reason/i), 'Creating dental vertical for testing');

    // Open the select and pick MEDICAL
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'MEDICAL' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create vertical/i })).toBeEnabled();
    });
  });

  it('Cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange } = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
