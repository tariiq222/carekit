"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Separator } from "@carekit/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

export function RemindersCard({ settings, onSave, isPending, t }: Props) {
  const [r24h, setR24h] = useState(true)
  const [r1h, setR1h] = useState(true)
  const [interactive, setInteractive] = useState(false)
  const [suggestAlt, setSuggestAlt] = useState(true)
  const [suggestCount, setSuggestCount] = useState("3")

  useEffect(() => {
    setR24h(settings.reminder24hEnabled)
    setR1h(settings.reminder1hEnabled)
    setInteractive(settings.reminderInteractive)
    setSuggestAlt(settings.suggestAlternativesOnConflict)
    setSuggestCount(String(settings.suggestAlternativesCount))
  }, [settings])

  return (
    <>
      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.reminders")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow title={t("settings.reminder24h")} desc={t("settings.reminder24hDesc")} checked={r24h} onChange={setR24h} />
          <Separator />
          <SwitchRow title={t("settings.reminder1h")} desc={t("settings.reminder1hDesc")} checked={r1h} onChange={setR1h} />
          <Separator />
          <SwitchRow title={t("settings.reminderInteractive")} desc={t("settings.reminderInteractiveDesc")} checked={interactive} onChange={setInteractive} />
          <Separator />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => onSave({
                reminder24hEnabled: r24h,
                reminder1hEnabled: r1h,
                reminderInteractive: interactive,
              })}
            >
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions & Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.suggestions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow title={t("settings.suggestAlternatives")} desc={t("settings.suggestAlternativesDesc")} checked={suggestAlt} onChange={setSuggestAlt} />
          {suggestAlt && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("settings.suggestCount")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.suggestCountDesc")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" value={suggestCount} onChange={(e) => setSuggestCount(e.target.value)} className="w-20 tabular-nums" min={1} max={10} />
                </div>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => onSave({
                suggestAlternativesOnConflict: suggestAlt,
                suggestAlternativesCount: Number(suggestCount) || 3,
              })}
            >
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function SwitchRow({ title, desc, checked, onChange }: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
