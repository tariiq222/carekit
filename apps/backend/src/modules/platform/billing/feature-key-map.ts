import { FeatureKey } from '@carekit/shared/constants/feature-keys';

/**
 * Maps each FeatureKey enum value to the corresponding key in Plan.limits JSON.
 * Used by FeatureGuard and GetMyFeaturesHandler.
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
};

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_KEY_MAP) as FeatureKey[];
