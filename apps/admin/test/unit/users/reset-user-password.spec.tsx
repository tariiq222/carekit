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
import { useResetUserPassword } from '@/features/users/reset-user-password/use-reset-user-password';
import { ResetPasswordDialog } from '@/features/users/reset-user-password/reset-password-dialog';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ResetPasswordDialog userId="u-1" userEmail="user@test.com" />
    </QueryClientProvider>,
  );
}

describe('useResetUserPassword hook', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('posts to /users/:id/reset-password', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    const { result } = renderHook(() => useResetUserPassword(), { wrapper: makeWrapper() });
    result.current.mutate({ userId: 'u-1', reason: 'User locked out of account' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adminRequest).toHaveBeenCalledWith('/users/u-1/reset-password', expect.objectContaining({ method: 'POST' }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Temp password'));
  });

  it('calls toast.error on failure', async () => {
    vi.mocked(adminRequest).mockRejectedValue(new Error('user_not_found'));
    const { result } = renderHook(() => useResetUserPassword(), { wrapper: makeWrapper() });
    result.current.mutate({ userId: 'u-none', reason: 'User locked out and needs help' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('user_not_found');
  });
});

describe('ResetPasswordDialog', () => {
  beforeEach(() => {
    vi.mocked(adminRequest).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it('renders a trigger button "Reset password"', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('opens dialog when trigger clicked', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    expect(screen.getByText(/user@test.com/i)).toBeInTheDocument();
  });

  it('Confirm reset button disabled when reason < 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await user.type(screen.getByRole('textbox'), 'short');
    expect(screen.getByRole('button', { name: /confirm reset/i })).toBeDisabled();
  });

  it('Confirm reset button enabled when reason >= 10 chars', async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await user.type(screen.getByRole('textbox'), 'User locked out, support call #1234');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm reset/i })).toBeEnabled();
    });
  });

  it('calls API and closes on success', async () => {
    vi.mocked(adminRequest).mockResolvedValue(undefined);
    renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /reset password/i }));
    await user.type(screen.getByRole('textbox'), 'User locked out, support call #1234');
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));
    await waitFor(() => expect(adminRequest).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
