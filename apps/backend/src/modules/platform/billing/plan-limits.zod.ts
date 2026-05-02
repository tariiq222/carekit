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
  maxStorageMB: z.number().int().min(-1),
  overageRateBookings: z.number().min(0),
  overageRateClients: z.number().min(0),
  overageRateStorageGB: z.number().min(0),
  recurring_bookings: z.boolean(),
  waitlist: z.boolean(),
  group_sessions: z.boolean(),
  ai_chatbot: z.boolean(),
  email_templates: z.boolean(),
  coupons: z.boolean(),
  advanced_reports: z.boolean(),
  intake_forms: z.boolean(),
  zatca: z.boolean(),
  custom_roles: z.boolean(),
  activity_log: z.boolean(),
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxBranches: 1,
  maxEmployees: 5,
  maxServices: -1,
  maxBookingsPerMonth: -1,
  maxClients: -1,
  maxStorageMB: 1024,
  overageRateBookings: 0,
  overageRateClients: 0,
  overageRateStorageGB: 0,
  recurring_bookings: false,
  waitlist: false,
  group_sessions: false,
  ai_chatbot: false,
  email_templates: false,
  coupons: false,
  advanced_reports: false,
  intake_forms: false,
  zatca: false,
  custom_roles: false,
  activity_log: false,
};

export function parsePlanLimits(raw: unknown): PlanLimits {
  return planLimitsSchema.parse(raw);
}
