import { z } from "zod";

/**
 * Backend mirror of apps/admin/features/plans/plan-limits.zod.ts.
 *
 * Used by plan-create / plan-update handlers under
 * src/modules/platform/admin/{create-plan,update-plan}/ to validate the
 * `limits` JSON before persisting. Keep this file in lockstep with the
 * admin one — feature-registry.validator.ts (Task 8) enforces shape
 * parity against FEATURE_KEY_MAP at startup.
 */
export const planLimitsSchema = z.object({
  maxBranches: z.number().int().min(-1),
  maxEmployees: z.number().int().min(-1),
  maxServices: z.number().int().min(-1),
  maxBookingsPerMonth: z.number().int().min(-1),
  maxClients: z.number().int().min(-1),
  overageRateBookings: z.number().min(0),
  overageRateClients: z.number().min(0),
  recurring_bookings: z.boolean(),
  waitlist: z.boolean(),
  group_sessions: z.boolean(),
  ai_chatbot: z.boolean(),
  email_templates: z.boolean(),
  coupons: z.boolean(),
  advanced_reports: z.boolean(),
  intake_forms: z.boolean(),
  custom_roles: z.boolean(),
  activity_log: z.boolean(),
  // Phase 3: 15 new boolean keys
  zoom_integration: z.boolean(),
  walk_in_bookings: z.boolean(),
  bank_transfer_payments: z.boolean(),
  multi_branch: z.boolean(),
  departments: z.boolean(),
  client_ratings: z.boolean(),
  data_export: z.boolean(),
  sms_provider_per_tenant: z.boolean(),
  white_label_mobile: z.boolean(),
  custom_domain: z.boolean(),
  api_access: z.boolean(),
  webhooks: z.boolean(),
  priority_support: z.boolean(),
  audit_export: z.boolean(),
  multi_currency: z.boolean(),
  email_fallback_monthly: z.number().int().min(-1),
  sms_fallback_monthly: z.number().int().min(-1),
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxBranches: 1,
  maxEmployees: 5,
  maxServices: -1,
  maxBookingsPerMonth: -1,
  maxClients: -1,
  overageRateBookings: 0,
  overageRateClients: 0,
  recurring_bookings: false,
  waitlist: false,
  group_sessions: false,
  ai_chatbot: false,
  email_templates: false,
  coupons: false,
  advanced_reports: false,
  intake_forms: false,
  custom_roles: false,
  activity_log: false,
  // Phase 3: 15 new boolean keys
  zoom_integration: false,
  walk_in_bookings: false,
  bank_transfer_payments: false,
  multi_branch: false,
  departments: false,
  client_ratings: false,
  data_export: false,
  sms_provider_per_tenant: false,
  white_label_mobile: false,
  custom_domain: false,
  api_access: false,
  webhooks: false,
  priority_support: false,
  audit_export: false,
  multi_currency: false,
  email_fallback_monthly: 500,
  sms_fallback_monthly: 100,
};

export function parsePlanLimits(raw: unknown): PlanLimits {
  return planLimitsSchema.parse(raw);
}
