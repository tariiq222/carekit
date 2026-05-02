import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveOverridesDialog } from '@/features/organizations/entitlements/save-overrides-dialog';

describe('SaveOverridesDialog', () => {
  const changes = [
    { key: 'coupons' as never, mode: 'FORCE_ON' as const },
    { key: 'recurring_bookings' as never, mode: 'INHERIT' as const },
  ];

  it('Confirm button disabled when reason < 10 chars', () => {
    render(<SaveOverridesDialog open onOpenChange={() => {}} changes={changes} onConfirm={async () => {}} />);
    const btn = screen.getByRole('button', { name: /confirm/i });
    expect(btn).toBeDisabled();
    const textarea = screen.getByLabelText(/reason/i);
    fireEvent.change(textarea, { target: { value: 'too short' } });
    expect(btn).toBeDisabled();
  });

  it('Confirm button enabled when reason ≥ 10 chars; clicking calls onConfirm once', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SaveOverridesDialog open onOpenChange={() => {}} changes={changes} onConfirm={onConfirm} />);
    const textarea = screen.getByLabelText(/reason/i);
    fireEvent.change(textarea, { target: { value: 'Pilot customer needs coupons enabled' } });
    const btn = screen.getByRole('button', { name: /confirm/i });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    await new Promise((r) => setTimeout(r, 0));
    expect(onConfirm).toHaveBeenCalledWith('Pilot customer needs coupons enabled');
  });
});
