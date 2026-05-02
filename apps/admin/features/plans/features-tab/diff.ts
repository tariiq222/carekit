import type { FeatureKey } from '@deqah/shared';
import type { PlanLimits } from './presets';

export function computeDowngrades(prev: PlanLimits, next: PlanLimits): FeatureKey[] {
  const out: FeatureKey[] = [];
  for (const k of Object.keys(prev.features) as FeatureKey[]) {
    if (prev.features[k] === true && next.features[k] !== true) out.push(k);
  }
  return out;
}
