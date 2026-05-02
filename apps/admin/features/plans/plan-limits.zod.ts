import { z } from "zod";
import type { PlanLimits } from "./plan-limits";

/**
 * Zod schema mirroring the PlanLimits interface. Used to validate raw
 * Plan.limits JSON read back from the API before handing it to the form,
 * and to validate user input before POST/PATCH.
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
}) satisfies z.ZodType<PlanLimits>;

export type PlanLimitsInput = z.input<typeof planLimitsSchema>;

export function parsePlanLimits(raw: unknown): PlanLimits {
  return planLimitsSchema.parse(raw);
}
