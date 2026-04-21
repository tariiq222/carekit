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

export function WaitlistCard({ settings, onSave, isPending, t }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [maxPerSlot, setMaxPerSlot] = useState("5")
  const [autoNotify, setAutoNotify] = useState(true)

  useEffect(() => {
    setEnabled(settings.waitlistEnabled)
    setMaxPerSlot(String(settings.waitlistMaxPerSlot))
    setAutoNotify(settings.waitlistAutoNotify)
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.waitlist")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.waitlistEnabled")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.waitlistEnabledDesc")}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.waitlistMaxPerSlot")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.waitlistMaxPerSlotDesc")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={maxPerSlot}
                  onChange={(e) => setMaxPerSlot(e.target.value)}
                  className="w-20 tabular-nums"
                  min={1}
                  max={50}
                />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.waitlistAutoNotify")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.waitlistAutoNotifyDesc")}</p>
              </div>
              <Switch checked={autoNotify} onCheckedChange={setAutoNotify} />
            </div>
          </>
        )}
        <Separator />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onSave({
              waitlistEnabled: enabled,
              waitlistMaxPerSlot: Number(maxPerSlot) || 5,
              waitlistAutoNotify: autoNotify,
            })}
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
