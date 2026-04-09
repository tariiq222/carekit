import { z } from "zod"

export const departmentSchema = z.object({
  nameAr: z.string().min(1, "Required").max(255),
  nameEn: z.string().min(1, "Required").max(255),
  descriptionAr: z.string().max(1000).optional().or(z.literal("")),
  descriptionEn: z.string().max(1000).optional().or(z.literal("")),
  icon: z.string().max(100).optional().or(z.literal("")),
  isActive: z.boolean(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
