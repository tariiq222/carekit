import { z } from "zod"

/* ─── Resolve report schema (resolve-dialog) ─── */

export const resolveProblemReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  adminNotes: z.string().optional(),
})

export type ResolveProblemReportFormData = z.infer<typeof resolveProblemReportSchema>
