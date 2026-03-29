import { z } from "zod"

/* ─── Zod Schema ─── */

export const createServiceSchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().uuid("services.create.categoryRequired"),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  hidePriceOnBooking: z.boolean().optional(),
  hideDurationOnBooking: z.boolean().optional(),
  calendarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  iconName: z.string().max(100).nullable().optional(),
  iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
  depositEnabled: z.boolean().optional(),
  depositPercent: z.coerce.number().int().min(1).max(100).optional(),
  allowRecurring: z.boolean().optional(),
  allowedRecurringPatterns: z.array(z.string()).optional(),
  maxRecurrences: z.coerce.number().int().min(1).max(52).optional(),
  maxParticipants: z.coerce.number().int().min(1).max(100).optional(),
  minLeadMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
})

export type CreateServiceFormData = z.infer<typeof createServiceSchema>

/* ─── Default Values ─── */

export const createServiceDefaults: CreateServiceFormData = {
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  categoryId: "" as string,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  calendarColor: null,
  iconName: null,
  iconBgColor: null,
  imageUrl: null,
  bufferMinutes: undefined,
  depositEnabled: false,
  depositPercent: 100,
  allowRecurring: false,
  allowedRecurringPatterns: [],
  maxRecurrences: 12,
  maxParticipants: 1,
  minLeadMinutes: null,
  maxAdvanceDays: null,
}
