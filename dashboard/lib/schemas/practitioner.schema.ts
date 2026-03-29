import { z } from "zod"

/* ─── Edit practitioner service schema (edit-practitioner-service-sheet) ─── */

export const editPractitionerServiceSchema = z.object({
  bufferMinutes: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

export type EditPractitionerServiceFormData = z.infer<typeof editPractitionerServiceSchema>

/* ─── Assign service schema (assign-service-sheet) ─── */

export const assignServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  bufferMinutes: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

export type AssignServiceFormData = z.infer<typeof assignServiceSchema>
