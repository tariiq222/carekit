"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { DateTimeInput } from "@/components/ui/date-time-input"
import type { CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
}

export function SessionStepScheduling({ form }: Props) {
  const { t } = useLocale()
  const schedulingMode = form.watch("schedulingMode")

  return (
    <div className="flex flex-col gap-4">
      {/* ── Scheduling Type ── */}
      <div className="space-y-3 rounded-lg border border-border/40 p-4">
        <Label className="font-semibold">{t("groupSessions.scheduling")}</Label>

        <RadioGroup
          value={schedulingMode}
          onValueChange={(v) => form.setValue("schedulingMode", v as "fixed_date" | "on_capacity")}
          className="flex flex-col gap-2 items-end"
        >
          {/* RTL: span (text) first → right side; RadioGroupItem → left of text */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <span className="text-sm">{t("groupSessions.fixedDate")}</span>
            <RadioGroupItem value="fixed_date" />
          </label>
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <span className="text-sm">{t("groupSessions.onCapacity")}</span>
            <RadioGroupItem value="on_capacity" />
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
              <p className="text-xs text-destructive">
                {form.formState.errors.startTime.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Publish & Expiry ── */}
      <div className="space-y-3 rounded-lg border border-border/40 p-4">
        {/*
          RTL DOM order rule (same as booking-tab SwitchRow):
          Label first (→ right), Switch last (→ left)
        */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label className="cursor-pointer">{t("groupSessions.publishForClients")}</Label>
          </div>
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
          <p className="text-xs text-muted-foreground">
            {t("groupSessions.expiresAtHint")}
          </p>
        </div>
      </div>
    </div>
  )
}
