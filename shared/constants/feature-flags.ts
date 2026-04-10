/**
 * Feature Flag Keys — single source of truth for all feature flag key names.
 * Used across backend, dashboard, and mobile to ensure consistency.
 */
export const FEATURE_FLAG_KEYS = [
  "coupons",
  "gift_cards",
  "intake_forms",
  "chatbot",
  "ratings",
  "multi_branch",
  "reports",
  "recurring",
  "walk_in",
  "waitlist",
  "zoom",
  "zatca",
  "departments",
  "groups",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
