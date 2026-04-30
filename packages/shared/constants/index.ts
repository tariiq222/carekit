export * from "./modules";
export * from "./roles";
export * from "./config";

// Legacy string-union type — kept for backward compatibility with
// sidebar-config, mobile, and any existing imports of FeatureFlagKey.
export { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "./feature-flags";

// New tiered feature-gating enum — use FeatureKey for all new code.
export { FeatureKey } from "./feature-keys";

export { PLATFORM_BRAND, LEGACY_BRAND_STRINGS } from "./brand";
