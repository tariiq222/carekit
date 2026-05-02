import { describe, expect, it } from 'vitest';
import { computeDowngrades } from '../../../../features/plans/features-tab/diff';
import type { PlanLimits } from '../../../../features/plans/features-tab/presets';

const make = (f: Record<string, boolean>): PlanLimits => ({ features: f, quotas: {} });

describe('computeDowngrades', () => {
  it('returns keys flipped from true to false', () => {
    const prev = make({ coupons: true, recurring_bookings: true });
    const next = make({ coupons: false, recurring_bookings: true });
    expect(computeDowngrades(prev, next)).toEqual(['coupons']);
  });

  it('ignores false→true transitions', () => {
    expect(computeDowngrades(make({ x: false }), make({ x: true }))).toEqual([]);
  });

  it('treats missing prev key as false (no downgrade)', () => {
    expect(computeDowngrades(make({}), make({ x: false }))).toEqual([]);
  });
});
