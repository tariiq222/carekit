"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import { Input } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

export function ReschedulingCard({ settings, onSave, isPending, t }: Props) {
  const [canReschedule, setCanReschedule] = useState(true)
  const [beforeHours, setBeforeHours] = useState("12")
  const [maxCount, setMaxCount] = useState("2")

  useEffect(() => {
    setCanReschedule(settings.clientCanReschedule)
    setBeforeHours(String(settings.rescheduleBeforeHours))
    setMaxCount(String(settings.maxReschedulesPerBooking))
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.rescheduling")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.clientCanReschedule")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.clientCanRescheduleDesc")}</p>
          </div>
          <Switch checked={canReschedule} onCheckedChange={setCanReschedule} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.rescheduleBeforeHours")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.rescheduleBeforeHoursDesc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" value={beforeHours} onChange={(e) => setBeforeHours(e.target.value)} className="w-20 tabular-nums" min={0} max={168} />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.maxReschedules")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.maxReschedulesDesc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className="w-20 tabular-nums" min={0} max={10} />
            <span className="text-xs text-muted-foreground">x</span>
          </div>
        </div>
        <Separator />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onSave({
              clientCanReschedule: canReschedule,
              rescheduleBeforeHours: Number(beforeHours) || 12,
              maxReschedulesPerBooking: Number(maxCount) || 2,
            })}
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
