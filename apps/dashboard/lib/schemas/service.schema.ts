import { z } from "zod"

/* ─── Create category schema (create-category-dialog) ─── */

export const createCategorySchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  sortOrder: z.coerce.number().int().min(0).optional(),
  departmentId: z.string().uuid({ message: "Required" }),
})

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>

/* ─── Edit category schema (edit-category-dialog) ─── */

export const editCategorySchema = z.object({
  nameEn: z.string().min(1, "Required").optional(),
  nameAr: z.string().min(1, "Required").optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().uuid().optional(),
})

export type EditCategoryFormData = z.infer<typeof editCategorySchema>
