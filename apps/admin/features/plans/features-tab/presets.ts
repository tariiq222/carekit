import { FEATURE_CATALOG, type FeatureKey } from '@deqah/shared';

export type PresetKind = 'PRO' | 'ENTERPRISE' | 'DISABLE_ALL';

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
