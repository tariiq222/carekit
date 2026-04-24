/**
 * Feature Keys — tiered feature flags for CareKit SaaS.
 *
 * PRO+ flags are on/off boolean gates.
 * ENTERPRISE-only flags are also on/off.
 * Quantitative keys carry both a flag (enabled/disabled) and a numeric limit.
 *
 * This const is the single source of truth consumed by:
 *   - FeatureGuard  (backend enforcement)
 *   - GetMyFeaturesHandler  (billing features endpoint)
 *   - useBillingFeatures / useSidebarNav  (dashboard)
 */
export const FeatureKey = {
  // ── On/Off — PRO+ ────────────────────────────────────────────────
  RECURRING_BOOKINGS: "recurring_bookings",
  WAITLIST: "waitlist",
  GROUP_SESSIONS: "group_sessions",
  AI_CHATBOT: "ai_chatbot",
  EMAIL_TEMPLATES: "email_templates",
  COUPONS: "coupons",

  // ── On/Off — ENTERPRISE only ──────────────────────────────────────
  ADVANCED_REPORTS: "advanced_reports",
  INTAKE_FORMS: "intake_forms",
  ZATCA: "zatca",
  CUSTOM_ROLES: "custom_roles",
  ACTIVITY_LOG: "activity_log",

  // ── Quantitative (flag + numeric limit) ───────────────────────────
  BRANCHES: "branches",
  EMPLOYEES: "employees",
  SERVICES: "services",
  MONTHLY_BOOKINGS: "monthly_bookings",
  STORAGE: "storage",
} as const;

export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey];
