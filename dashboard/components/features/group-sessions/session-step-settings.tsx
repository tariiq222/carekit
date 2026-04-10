"use client"

import type { UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CreateGroupSessionFormValues } from "@/lib/schemas/group-sessions.schema"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
}

export function SessionStepSettings({ form }: Props) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("groupSessions.minParticipants")}</Label>
          <Input type="number" {...form.register("minParticipants", { valueAsNumber: true })} />
          {form.formState.errors.minParticipants && (
            <p className="text-xs text-destructive">{form.formState.errors.minParticipants.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("groupSessions.maxParticipants")}</Label>
          <Input type="number" {...form.register("maxParticipants", { valueAsNumber: true })} />
          {form.formState.errors.maxParticipants && (
            <p className="text-xs text-destructive">{form.formState.errors.maxParticipants.message}</p>
          )}
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
    </div>
  )
}
