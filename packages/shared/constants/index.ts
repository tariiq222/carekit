export * from "./modules";
export * from "./roles";
export * from "./config";

// Tiered feature-gating enum — the single source of truth for billing-gated
// features. Consumed by FeatureGuard (backend), GetMyFeaturesHandler,
// useBillingFeatures + useSidebarNav (dashboard), and the admin Plans tab.
export { FeatureKey } from "./feature-keys";

export { PLATFORM_BRAND, LEGACY_BRAND_STRINGS } from "./brand";
