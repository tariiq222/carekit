import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG, FeatureKey } from '@deqah/shared';
import { filterCatalog } from '../../../../features/plans/features-tab/filter';

describe('filterCatalog', () => {
  it('returns full catalog when query is empty', () => {
    expect(filterCatalog('').length).toBe(Object.keys(FEATURE_CATALOG).length);
  });

  it('matches case-insensitively across nameEn and descEn', () => {
    const out = filterCatalog('zoom');
    expect(out.find(([k]) => k === FeatureKey.ZOOM_INTEGRATION)).toBeDefined();
  });

  it('returns empty for nonsense', () => {
    expect(filterCatalog('zzz_nope_xx').length).toBe(0);
  });
});
