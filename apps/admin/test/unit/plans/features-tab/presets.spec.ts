import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG, FeatureKey } from '@deqah/shared';
import { applyPreset, type PlanLimits } from '../../../../features/plans/features-tab/presets';

const baseline: PlanLimits = { features: {}, quotas: {} } as PlanLimits;

describe('applyPreset', () => {
  it('PRO preset enables every PRO-tier key and disables ENTERPRISE', () => {
    const next = applyPreset(baseline, 'PRO');
    for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
      if (entry.kind !== 'boolean') continue;
      expect(next.features[key as FeatureKey]).toBe(entry.tier === 'PRO');
    }
  });

  it('ENTERPRISE preset enables every boolean key', () => {
    const next = applyPreset(baseline, 'ENTERPRISE');
    for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
      if (entry.kind !== 'boolean') continue;
      expect(next.features[key as FeatureKey]).toBe(true);
    }
  });

  it('DISABLE_ALL turns every boolean off', () => {
    const next = applyPreset(baseline, 'DISABLE_ALL');
    for (const [key, entry] of Object.entries(FEATURE_CATALOG)) {
      if (entry.kind !== 'boolean') continue;
      expect(next.features[key as FeatureKey]).toBe(false);
    }
  });

  it('preserves quotas untouched', () => {
    const start: PlanLimits = { features: {}, quotas: { employees: 5 } } as PlanLimits;
    expect(applyPreset(start, 'PRO').quotas).toEqual({ employees: 5 });
  });
});
