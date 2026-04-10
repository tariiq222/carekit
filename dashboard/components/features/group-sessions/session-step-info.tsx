"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"
import { PractitionerSelectField } from "./practitioner-select-field"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
}

export function SessionStepInfo({ form }: Props) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col gap-4">
      {/* ── Name row ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("groupSessions.nameAr")}</Label>
          <Input {...form.register("nameAr")} dir="rtl" />
          {form.formState.errors.nameAr && (
            <p className="text-xs text-destructive">{form.formState.errors.nameAr.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("groupSessions.nameEn")}</Label>
          <Input {...form.register("nameEn")} dir="ltr" />
          {form.formState.errors.nameEn && (
            <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
          )}
        </div>
      </div>

      {/* ── Description row ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("groupSessions.descriptionAr")}</Label>
          <Textarea {...form.register("descriptionAr")} dir="rtl" rows={3} />
        </div>
        <div className="space-y-2">
          <Label>{t("groupSessions.descriptionEn")}</Label>
          <Textarea {...form.register("descriptionEn")} dir="ltr" rows={3} />
        </div>
      </div>

      {/* ── Practitioner selector ── */}
      <div className="space-y-2">
        <Label>{t("groupSessions.practitioner")}</Label>
        <Controller
          name="practitionerId"
          control={form.control}
          render={({ field }) => (
            <PractitionerSelectField
              value={field.value}
              onChange={field.onChange}
              error={form.formState.errors.practitionerId?.message}
            />
          )}
        />
      </div>
    </div>
  )
}
