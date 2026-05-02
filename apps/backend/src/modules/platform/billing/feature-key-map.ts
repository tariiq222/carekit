import { FeatureKey } from '@deqah/shared/constants/feature-keys';

/**
 * Maps each FeatureKey enum value to the corresponding key in Plan.limits JSON.
 * Used by FeatureGuard and GetMyFeaturesHandler.
 *
 * UI / marketing-only keys (no backend enforcement surface in Phase 3) — these
 * keys are surfaced to tenants for plan-comparison + roadmap signaling but do
 * not yet correspond to any HTTP endpoint:
 *   - white_label_mobile  (mobile is single-tenant-per-build; no runtime gate)
 *   - custom_domain       (not yet implemented platform-side)
 *   - api_access          (public API not yet shipped)
 *   - webhooks            (no outbound webhook system yet)
 *   - priority_support    (operational, not technical, signal)
 *   - audit_export        (audit log read endpoint already gated by ACTIVITY_LOG)
 *   - multi_currency      (single-currency platform today)
 *
 * Two additional Phase 3 keys are deferred (no current backend surface):
 *   - walk_in_bookings    (no dashboard route exposes the walk-in slice yet)
 *   - data_export         (no dedicated export route — see ADVANCED_REPORTS)
 *
 * Adding a backend surface for any of these MUST be paired with @RequireFeature.
 */
export const FEATURE_KEY_MAP: Record<FeatureKey, string> = {
  [FeatureKey.RECURRING_BOOKINGS]: 'recurring_bookings',
  [FeatureKey.WAITLIST]: 'waitlist',
  [FeatureKey.GROUP_SESSIONS]: 'group_sessions',
  [FeatureKey.AI_CHATBOT]: 'ai_chatbot',
  [FeatureKey.EMAIL_TEMPLATES]: 'email_templates',
  [FeatureKey.COUPONS]: 'coupons',
  [FeatureKey.ADVANCED_REPORTS]: 'advanced_reports',
  [FeatureKey.INTAKE_FORMS]: 'intake_forms',
  [FeatureKey.ZATCA]: 'zatca',
  [FeatureKey.CUSTOM_ROLES]: 'custom_roles',
  [FeatureKey.ACTIVITY_LOG]: 'activity_log',
  [FeatureKey.BRANCHES]: 'maxBranches',
  [FeatureKey.EMPLOYEES]: 'maxEmployees',
  [FeatureKey.SERVICES]: 'maxServices',
  [FeatureKey.MONTHLY_BOOKINGS]: 'maxBookingsPerMonth',
  [FeatureKey.STORAGE]: 'maxStorageMB',
  // ── Phase 3: 15 new boolean keys ──────────────────────────────────
  [FeatureKey.ZOOM_INTEGRATION]: 'zoom_integration',
  [FeatureKey.WALK_IN_BOOKINGS]: 'walk_in_bookings',
  [FeatureKey.BANK_TRANSFER_PAYMENTS]: 'bank_transfer_payments',
  [FeatureKey.MULTI_BRANCH]: 'multi_branch',
  [FeatureKey.DEPARTMENTS]: 'departments',
  [FeatureKey.CLIENT_RATINGS]: 'client_ratings',
  [FeatureKey.DATA_EXPORT]: 'data_export',
  [FeatureKey.SMS_PROVIDER_PER_TENANT]: 'sms_provider_per_tenant',
  [FeatureKey.WHITE_LABEL_MOBILE]: 'white_label_mobile',
  [FeatureKey.CUSTOM_DOMAIN]: 'custom_domain',
  [FeatureKey.API_ACCESS]: 'api_access',
  [FeatureKey.WEBHOOKS]: 'webhooks',
  [FeatureKey.PRIORITY_SUPPORT]: 'priority_support',
  [FeatureKey.AUDIT_EXPORT]: 'audit_export',
  [FeatureKey.MULTI_CURRENCY]: 'multi_currency',
};

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_KEY_MAP) as FeatureKey[];
