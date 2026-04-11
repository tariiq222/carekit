import { z } from "zod"

/* ─── User base schema (user-form-page) ─── */

export const userBaseSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional().refine(
    (v) => !v || /^\+[1-9]\d{6,14}$/.test(v),
    { message: "أدخل الرقم بصيغة دولية مثل: +966501234567" }
  ),
  gender: z.enum(["male", "female"]).optional(),
})

export const userCreateSchema = userBaseSchema.extend({
  password: z.string().min(8),
  roleSlug: z.string().min(1),
})

export const userEditSchema = userBaseSchema.extend({
  roleSlug: z.string().optional(),
})

export type UserBaseFormData   = z.infer<typeof userBaseSchema>
export type UserCreateFormData = z.infer<typeof userCreateSchema>
export type UserEditFormData   = z.infer<typeof userEditSchema>

/* ─── Create role schema (create-role-dialog) ─── */

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
})

export type CreateRoleFormData = z.infer<typeof createRoleSchema>
