"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { useLocale } from "@/components/locale-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { DateTimeInput } from "@/components/ui/date-time-input"
import type { CourseFormValues } from "@/lib/schemas/courses.schema"

const FREQUENCIES = ["weekly", "biweekly", "monthly"] as const

interface Props {
  form: UseFormReturn<CourseFormValues>
}

export function CourseStepSessions({ form }: Props) {
  const { t } = useLocale()
  const { register, control, formState: { errors } } = form

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("courses.totalSessions")}</Label>
          <Input
            type="number"
            min={1}
            max={52}
            {...register("totalSessions", { valueAsNumber: true })}
          />
          {errors.totalSessions && (
            <p className="text-xs text-destructive">{errors.totalSessions.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("courses.durationPerSession")}</Label>
          <div className="relative">
            <Input
              type="number"
              min={15}
              max={480}
              {...register("durationPerSessionMin", { valueAsNumber: true })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("courses.minutes")}</p>
          {errors.durationPerSessionMin && (
            <p className="text-xs text-destructive">{errors.durationPerSessionMin.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("courses.frequency")}</Label>
        <Controller
          name="frequency"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("courses.frequency")} />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {t(`courses.frequency.${freq}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.frequency && (
          <p className="text-xs text-destructive">{errors.frequency.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("courses.startDate")}</Label>
        <Controller
          name="startDate"
          control={control}
          render={({ field }) => (
            <DateTimeInput value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.startDate && (
          <p className="text-xs text-destructive">{errors.startDate.message}</p>
        )}
      </div>
    </div>
  )
}
