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
}) satisfies z.ZodType<PlanLimits>;

export type PlanLimitsInput = z.input<typeof planLimitsSchema>;

export function parsePlanLimits(raw: unknown): PlanLimits {
  return planLimitsSchema.parse(raw);
}
