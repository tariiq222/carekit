import { FEATURE_CATALOG, type FeatureKey } from '@deqah/shared';

export type CatalogEntry = (typeof FEATURE_CATALOG)[FeatureKey];

export function filterCatalog(query: string): Array<[FeatureKey, CatalogEntry]> {
  const q = query.trim().toLowerCase();
  const all = Object.entries(FEATURE_CATALOG) as Array<[FeatureKey, CatalogEntry]>;
  if (!q) return all;
  return all.filter(
    ([, e]) =>
      e.nameEn.toLowerCase().includes(q) || e.descEn.toLowerCase().includes(q),
  );
}
