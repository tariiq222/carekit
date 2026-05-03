import { FEATURE_CATALOG, type FeatureKey } from '@deqah/shared';
import type { PlanLimits as FlatPlanLimits } from '../plan-limits';

export type PresetKind = 'PRO' | 'ENTERPRISE' | 'DISABLE_ALL';

/** Legacy shape — retained so diff.ts / computeDowngrades continues to work. */
export type PlanLimits = {
  features: Partial<Record<FeatureKey, boolean>>;
  quotas: Record<string, number>;
};

export function applyPreset(prev: PlanLimits, kind: PresetKind): PlanLimits {
  const features: Partial<Record<FeatureKey, boolean>> = {};
  for (const [k, entry] of Object.entries(FEATURE_CATALOG)) {
    if (entry.kind !== 'boolean') continue;
    const key = k as FeatureKey;
    if (kind === 'DISABLE_ALL') features[key] = false;
    else if (kind === 'ENTERPRISE') features[key] = true;
    else features[key] = entry.tier === 'PRO';
  }
  return { features, quotas: { ...prev.quotas } };
}

/**
 * Apply a preset to a flat PlanLimits object, only touching boolean feature
 * keys (quantitative and numeric quota fields are preserved from `prev`).
 */
export function applyPresetFlat(prev: FlatPlanLimits, kind: PresetKind): FlatPlanLimits {
  const next = { ...prev };
  for (const [k, entry] of Object.entries(FEATURE_CATALOG)) {
    if (entry.kind !== 'boolean') continue;
    const key = k as FeatureKey;
    if (kind === 'DISABLE_ALL') {
      (next as Record<string, unknown>)[key] = false;
    } else if (kind === 'ENTERPRISE') {
      (next as Record<string, unknown>)[key] = true;
    } else {
      (next as Record<string, unknown>)[key] = entry.tier === 'PRO';
    }
  }
  return next;
}
