"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@carekit/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

export function RecurringCard({ settings, onSave, isPending, t }: Props) {
  const [allowRecurring, setAllowRecurring] = useState(false)

  useEffect(() => {
    setAllowRecurring(settings.allowRecurring)
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.recurring")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.allowRecurring")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.allowRecurringDesc")}</p>
          </div>
          <Switch checked={allowRecurring} onCheckedChange={setAllowRecurring} />
        </div>
        <Separator />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onSave({ allowRecurring })}
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
