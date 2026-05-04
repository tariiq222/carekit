import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PresetButtons } from '@/features/plans/features-tab/preset-buttons';
import { DEFAULT_PLAN_LIMITS } from '@/features/plans/plan-limits';

vi.mock('@/lib/api-client', () => ({ adminRequest: vi.fn() }));

describe('PresetButtons', () => {
  it('renders PRO preset button', () => {
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /apply pro preset/i })).toBeInTheDocument();
  });

  it('renders ENTERPRISE preset button', () => {
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /apply enterprise preset/i })).toBeInTheDocument();
  });

  it('renders Disable all button', () => {
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /disable all/i })).toBeInTheDocument();
  });

  it('clicking PRO calls onLimitsChange with PRO preset applied', async () => {
    const onLimitsChange = vi.fn();
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={onLimitsChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply pro preset/i }));
    expect(onLimitsChange).toHaveBeenCalledTimes(1);
    const newLimits = onLimitsChange.mock.calls[0][0];
    // PRO preset enables recurring_bookings (a PRO feature)
    expect(newLimits.recurring_bookings).toBe(true);
  });

  it('clicking ENTERPRISE calls onLimitsChange with all booleans true', async () => {
    const onLimitsChange = vi.fn();
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={onLimitsChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply enterprise preset/i }));
    expect(onLimitsChange).toHaveBeenCalledTimes(1);
    const newLimits = onLimitsChange.mock.calls[0][0];
    expect(newLimits.ai_chatbot).toBe(true);
    expect(newLimits.white_label_mobile).toBe(true);
  });

  it('clicking Disable all calls onLimitsChange with all booleans false', async () => {
    const onLimitsChange = vi.fn();
    const allEnabled = { ...DEFAULT_PLAN_LIMITS, recurring_bookings: true, ai_chatbot: true };
    render(<PresetButtons limits={allEnabled} onLimitsChange={onLimitsChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /disable all/i }));
    expect(onLimitsChange).toHaveBeenCalledTimes(1);
    const newLimits = onLimitsChange.mock.calls[0][0];
    expect(newLimits.recurring_bookings).toBe(false);
    expect(newLimits.ai_chatbot).toBe(false);
  });

  it('preset does not change numeric quota fields', async () => {
    const onLimitsChange = vi.fn();
    const withQuotas = { ...DEFAULT_PLAN_LIMITS, maxBranches: 5, maxEmployees: 10 };
    render(<PresetButtons limits={withQuotas} onLimitsChange={onLimitsChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply pro preset/i }));
    const newLimits = onLimitsChange.mock.calls[0][0];
    expect(newLimits.maxBranches).toBe(5);
    expect(newLimits.maxEmployees).toBe(10);
  });

  it('renders 3 buttons total', () => {
    render(<PresetButtons limits={DEFAULT_PLAN_LIMITS} onLimitsChange={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
