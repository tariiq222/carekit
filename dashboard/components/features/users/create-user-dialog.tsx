"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useRoles, useUserMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"

/* ─── Schema ─── */

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  roleSlug: z.string().min(1, "Role is required"),
})

type CreateUserForm = z.infer<typeof createUserSchema>

/* ─── Props ─── */

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { t } = useLocale()
  const { data: roles } = useRoles()
  const { createMut } = useUserMutations()

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      gender: undefined,
      roleSlug: "",
    },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        ...data,
        phone: data.phone || undefined,
      })
      toast.success(t("users.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.create.error"))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("users.create.title")}</SheetTitle>
          <SheetDescription>
            {t("users.create.description")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form id="create-user-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("users.create.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("users.create.emailPlaceholder")}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("users.create.password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("users.create.passwordPlaceholder")}
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="firstName">{t("users.create.firstName")}</Label>
                <Input
                  id="firstName"
                  placeholder={t("users.create.firstName")}
                  {...form.register("firstName")}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lastName">{t("users.create.lastName")}</Label>
                <Input
                  id="lastName"
                  placeholder={t("users.create.lastName")}
                  {...form.register("lastName")}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t("users.create.phone")}</Label>
              <Input
                id="phone"
                placeholder={t("users.create.phonePlaceholder")}
                {...form.register("phone")}
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.gender")}</Label>
              <Select
                value={form.watch("gender") ?? ""}
                onValueChange={(v) =>
                  form.setValue("gender", v as "male" | "female", { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("users.create.genderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("users.create.male")}</SelectItem>
                  <SelectItem value="female">{t("users.create.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.role")}</Label>
              <Select
                value={form.watch("roleSlug")}
                onValueChange={(v) =>
                  form.setValue("roleSlug", v, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("users.create.rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.slug}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.roleSlug && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.roleSlug.message}
                </p>
              )}
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("users.create.cancel")}
          </Button>
          <Button type="submit" form="create-user-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("users.create.submitting") : t("users.create.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
