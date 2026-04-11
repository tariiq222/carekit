"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
    setCanReschedule(settings.patientCanReschedule)
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
            <p className="text-sm font-medium text-foreground">{t("settings.patientCanReschedule")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.patientCanRescheduleDesc")}</p>
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
              patientCanReschedule: canReschedule,
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
