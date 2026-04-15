import { z } from "zod"

export const departmentSchema = z.object({
  nameAr: z
    .string()
    .min(1, { message: "validation.required" })
    .max(255, { message: "validation.maxLength" }),
  nameEn: z
    .string()
    .min(1, { message: "validation.required" })
    .max(255, { message: "validation.maxLength" }),
  descriptionAr: z.string().max(1000, { message: "validation.maxLength" }).optional().or(z.literal("")),
  descriptionEn: z.string().max(1000, { message: "validation.maxLength" }).optional().or(z.literal("")),
  icon: z.string().max(100, { message: "validation.maxLength" }).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
