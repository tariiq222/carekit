"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  UserIcon,
  LockIcon,
  SmartPhone01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/features/section-header"
import { useLocale } from "@/components/locale-provider"

interface Role { id: string; slug: string; name: string }

interface UserFormFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  isEdit: boolean
  roles?: Role[]
}

export function UserFormFields({ form, isEdit, roles }: UserFormFieldsProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Personal Info ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={UserIcon}
            title={t("users.create.firstName")}
            description={t("users.create.description")}
          />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("users.create.firstName")} *</Label>
                <Input placeholder={t("users.create.firstName")} {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">{form.formState.errors.firstName.message as string}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("users.create.lastName")} *</Label>
                <Input placeholder={t("users.create.lastName")} {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">{form.formState.errors.lastName.message as string}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.gender")}</Label>
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v as "male" | "female")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("users.create.genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("users.create.male")}</SelectItem>
                      <SelectItem value="female">{t("users.create.female")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Account Info ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={isEdit ? SmartPhone01Icon : LockIcon}
            title={t("users.create.email")}
            description={t("users.create.emailPlaceholder")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.email")} *</Label>
              <Input type="email" placeholder={t("users.create.emailPlaceholder")} {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message as string}</p>
              )}
            </div>
            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("users.create.password")} *</Label>
                <Input type="password" placeholder={t("users.create.passwordPlaceholder")} {...form.register("password")} />
                {(form.formState.errors as { password?: { message?: string } }).password && (
                  <p className="text-xs text-destructive">
                    {(form.formState.errors as { password?: { message?: string } }).password?.message}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.create.phone")}</Label>
              <Controller
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Role (create required / edit optional) ── */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <SectionHeader
            icon={UserCheck01Icon}
            title={t("users.create.role")}
            description={t("users.create.rolePlaceholder")}
          />
          <Controller
            control={form.control}
            name="roleSlug"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder={t("users.create.rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => (
                    <SelectItem key={role.id} value={role.slug}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {(form.formState.errors as { roleSlug?: { message?: string } }).roleSlug && (
            <p className="text-xs text-destructive mt-1.5">
              {(form.formState.errors as { roleSlug?: { message?: string } }).roleSlug?.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
