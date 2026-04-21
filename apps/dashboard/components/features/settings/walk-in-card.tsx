"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

export function WalkInCard({ settings, onSave, isPending, t }: Props) {
  const [allowWalkIn, setAllowWalkIn] = useState(false)
  const [paymentRequired, setPaymentRequired] = useState(false)

  useEffect(() => {
    setAllowWalkIn(settings.allowWalkIn)
    setPaymentRequired(settings.walkInPaymentRequired)
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.walkIn")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.allowWalkIn")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.allowWalkInDesc")}</p>
          </div>
          <Switch checked={allowWalkIn} onCheckedChange={setAllowWalkIn} />
        </div>
        {allowWalkIn && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.walkInPaymentRequired")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.walkInPaymentRequiredDesc")}</p>
              </div>
              <Switch checked={paymentRequired} onCheckedChange={setPaymentRequired} />
            </div>
          </>
        )}
        <Separator />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onSave({
              allowWalkIn,
              walkInPaymentRequired: paymentRequired,
            })}
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
