"use client"

import { Controller, useWatch, type UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { CourseFormValues } from "@/lib/schemas/courses.schema"

const DELIVERY_MODES = ["in_person", "online", "hybrid"] as const

interface Props {
  form: UseFormReturn<CourseFormValues>
}

export function CourseStepPricing({ form }: Props) {
  const { t } = useLocale()
  const { register, control, formState: { errors } } = form

  const isGroup = useWatch({ control, name: "isGroup" })
  const deliveryMode = useWatch({ control, name: "deliveryMode" })
  const showLocation = deliveryMode === "in_person" || deliveryMode === "hybrid"

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label>{t("courses.price")}</Label>
        <Input
          type="number"
          min={0}
          {...register("priceHalalat", { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">{t("courses.priceHint")}</p>
        {errors.priceHalalat && (
          <p className="text-xs text-destructive">{errors.priceHalalat.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
        <div>
          <Label className="cursor-pointer">{t("courses.isGroup")}</Label>
        </div>
        <Controller
          name="isGroup"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {isGroup && (
        <div className="space-y-2">
          <Label>{t("courses.maxParticipants")}</Label>
          <Input
            type="number"
            min={2}
            {...register("maxParticipants", { valueAsNumber: true })}
          />
          {errors.maxParticipants && (
            <p className="text-xs text-destructive">{errors.maxParticipants.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("courses.deliveryMode")}</Label>
        <Controller
          name="deliveryMode"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("courses.deliveryMode")} />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {t(`courses.deliveryMode.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.deliveryMode && (
          <p className="text-xs text-destructive">{errors.deliveryMode.message}</p>
        )}
      </div>

      {showLocation && (
        <div className="space-y-2">
          <Label>{t("courses.location")}</Label>
          <Input {...register("location")} />
          <p className="text-xs text-muted-foreground">{t("courses.locationHint")}</p>
          {errors.location && (
            <p className="text-xs text-destructive">{errors.location.message}</p>
          )}
        </div>
      )}
    </div>
  )
}
