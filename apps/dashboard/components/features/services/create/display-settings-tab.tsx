"use client"

import { Button } from "@carekit/ui"
import { Label } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "./form-schema"

/* ─── Props ─── */

interface DisplaySettingsTabProps {
  form: UseFormReturn<CreateServiceFormData>
}

/* ─── Component ─── */

export function DisplaySettingsTab({ form }: DisplaySettingsTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("services.create.tabs.display")}</CardTitle>
        <CardDescription>
          {t("services.create.tabs.displayDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visibility Toggles — single row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hidden" className="cursor-pointer text-xs">
              {isAr ? "إخفاء الخدمة" : "Hide Service"}
            </Label>
            <Switch
              id="create-hidden"
              checked={form.watch("isHidden")}
              onCheckedChange={(v) => form.setValue("isHidden", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hide-price" className="cursor-pointer text-xs">
              {isAr ? "إخفاء السعر عند الحجز" : "Hide Price"}
            </Label>
            <Switch
              id="create-hide-price"
              checked={form.watch("hidePriceOnBooking")}
              onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="create-hide-duration" className="cursor-pointer text-xs">
              {isAr ? "إخفاء المدة عند الحجز" : "Hide Duration"}
            </Label>
            <Switch
              id="create-hide-duration"
              checked={form.watch("hideDurationOnBooking")}
              onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
            />
          </div>
        </div>

        {/* Calendar Color */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="create-calendar-color">
            {isAr ? "لون التقويم" : "Calendar Color"}
          </Label>
          <div className="flex items-center gap-3">
            <input
              id="create-calendar-color"
              type="color"
              value={form.watch("calendarColor") ?? "#3b82f6"}
              onChange={(e) => form.setValue("calendarColor", e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {form.watch("calendarColor") ?? "\u2014"}
            </span>
            {form.watch("calendarColor") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => form.setValue("calendarColor", null)}
              >
                {isAr ? "إزالة" : "Clear"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
