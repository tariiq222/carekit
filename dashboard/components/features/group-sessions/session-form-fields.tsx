"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DateTimeInput } from "@/components/ui/date-time-input"
import type { CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
}

export function SessionFormFields({ form }: Props) {
  const { t } = useLocale()
  const schedulingMode = form.watch("schedulingMode")

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="space-y-2">
        <Label>{t("groupSessions.descriptionAr")}</Label>
        <Textarea {...form.register("descriptionAr")} dir="rtl" rows={2} />
      </div>

      <div className="space-y-2">
        <Label>{t("groupSessions.descriptionEn")}</Label>
        <Textarea {...form.register("descriptionEn")} dir="ltr" rows={2} />
      </div>

      <div className="space-y-2">
        <Label>{t("groupSessions.practitioner")}</Label>
        <Input {...form.register("practitionerId")} placeholder="UUID" />
        {form.formState.errors.practitionerId && (
          <p className="text-xs text-destructive">{form.formState.errors.practitionerId.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("groupSessions.minParticipants")}</Label>
          <Input type="number" {...form.register("minParticipants", { valueAsNumber: true })} />
        </div>
        <div className="space-y-2">
          <Label>{t("groupSessions.maxParticipants")}</Label>
          <Input type="number" {...form.register("maxParticipants", { valueAsNumber: true })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("groupSessions.pricePerPerson")}</Label>
          <Input type="number" {...form.register("pricePerPersonHalalat", { valueAsNumber: true })} />
          <p className="text-xs text-muted-foreground">{t("groupSessions.priceHint")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("groupSessions.duration")}</Label>
          <Input type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("groupSessions.paymentDeadline")}</Label>
        <Input type="number" {...form.register("paymentDeadlineHours", { valueAsNumber: true })} />
        <p className="text-xs text-muted-foreground">{t("groupSessions.paymentDeadlineHint")}</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border/40 p-4">
        <Label className="font-semibold">{t("groupSessions.scheduling")}</Label>
        <RadioGroup
          value={schedulingMode}
          onValueChange={(v) => form.setValue("schedulingMode", v as "fixed_date" | "on_capacity")}
          className="flex flex-col gap-3"
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <RadioGroupItem value="fixed_date" />
            <span className="text-sm">{t("groupSessions.fixedDate")}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <RadioGroupItem value="on_capacity" />
            <span className="text-sm">{t("groupSessions.onCapacity")}</span>
          </label>
        </RadioGroup>

        {schedulingMode === "fixed_date" && (
          <div className="space-y-2 pt-2">
            <Label>{t("groupSessions.startTime")}</Label>
            <Controller
              name="startTime"
              control={form.control}
              render={({ field }) => (
                <DateTimeInput value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            {form.formState.errors.startTime && (
              <p className="text-xs text-destructive">{form.formState.errors.startTime.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border/40 p-4">
        <div className="flex items-center justify-between">
          <Label>{t("groupSessions.publishForClients")}</Label>
          <Switch
            checked={form.watch("isPublished")}
            onCheckedChange={(v) => form.setValue("isPublished", v)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("groupSessions.expiresAt")}</Label>
          <Controller
            name="expiresAt"
            control={form.control}
            render={({ field }) => (
              <DateTimeInput value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
          <p className="text-xs text-muted-foreground">{t("groupSessions.expiresAtHint")}</p>
        </div>
      </div>
    </div>
  )
}
