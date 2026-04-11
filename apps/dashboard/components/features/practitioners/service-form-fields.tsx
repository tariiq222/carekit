"use client"

import type { UseFormReturn } from "react-hook-form"
import { Controller } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/* ─── Constants ─── */

const BOOKING_TYPES = [
  { value: "in_person", key: "inPerson" },
  { value: "online", key: "online" },
] as const

/* ─── Types ─── */

export interface ServiceFormValues {
  availableTypes: string[]
  customDuration: string
  bufferMinutes: string
  isActive: boolean
}

interface ServiceFormFieldsProps {
  form: UseFormReturn<ServiceFormValues & Record<string, unknown>>
  t: (key: string) => string
  defaultPriceDisplay: string
  defaultDurationDisplay: string
}

/* ─── Helpers ─── */

export function sarToHalalat(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null
  const num = parseFloat(val)
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

export function halalToSar(val: number | null): string {
  if (val == null) return ""
  return (val / 100).toFixed(2)
}

export function parseOptionalInt(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null
  const num = parseInt(val, 10)
  return isNaN(num) ? null : num
}

/* ─── Component ─── */

export function ServiceFormFields({
  form,
  t,
  defaultDurationDisplay,
}: ServiceFormFieldsProps) {
  const watchedTypes = form.watch("availableTypes")

  const toggleType = (type: string) => {
    const current = form.getValues("availableTypes")
    const updated = current.includes(type)
      ? current.filter((v) => v !== type)
      : [...current, type]
    form.setValue("availableTypes", updated, { shouldValidate: true })
  }

  const durationPlaceholder = defaultDurationDisplay
    ? `${t("practitioners.services.defaultPrice")}: ${defaultDurationDisplay} ${t("practitioners.services.minutes")}`
    : t("practitioners.services.durationHint")

  return (
    <>
      {/* Available Types */}
      <div className="flex flex-col gap-2">
        <Label>{t("practitioners.services.availableTypes")}</Label>
        <div className="flex flex-wrap gap-2">
          {BOOKING_TYPES.map(({ value, key }) => (
            <Button
              key={value}
              type="button"
              variant={
                watchedTypes.includes(value) ? "default" : "outline"
              }
              size="sm"
              className="h-8 text-xs"
              onClick={() => toggleType(value)}
            >
              {t(`practitioners.services.${key}`)}
            </Button>
          ))}
        </div>
        {form.formState.errors.availableTypes && (
          <p className="text-xs text-destructive">
            {t("practitioners.services.typesRequired")}
          </p>
        )}
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <Label>
          {t("practitioners.services.customDuration")} (
          {t("practitioners.services.minutes")})
        </Label>
        <Input
          type="number"
          min="1"
          className="tabular-nums"
          placeholder={durationPlaceholder}
          {...form.register("customDuration")}
        />
        <p className="text-xs text-muted-foreground">
          {t("practitioners.services.durationHint")}
        </p>
      </div>

      {/* Buffer */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">
          {t("practitioners.services.bufferMinutes")}
        </Label>
        <Input
          type="number"
          min="0"
          className="tabular-nums"
          {...form.register("bufferMinutes")}
        />
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between">
        <Label>{t("common.active")}</Label>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  )
}
