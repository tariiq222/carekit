"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

export function NoShowCard({ settings, onSave, isPending, t }: Props) {
  const [autoComplete, setAutoComplete] = useState("2")
  const [autoNoShow, setAutoNoShow] = useState("30")
  const [policy, setPolicy] = useState("keep_full")
  const [refundPercent, setRefundPercent] = useState("0")

  useEffect(() => {
    setAutoComplete(String(settings.autoCompleteAfterHours))
    setAutoNoShow(String(settings.autoNoShowAfterMinutes))
    setPolicy(settings.noShowPolicy)
    setRefundPercent(String(settings.noShowRefundPercent))
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.noShow")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.autoCompleteAfter")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.autoCompleteAfterDesc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" value={autoComplete} onChange={(e) => setAutoComplete(e.target.value)} className="w-20 tabular-nums" min={1} max={48} />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.autoNoShowAfter")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.autoNoShowAfterDesc")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" value={autoNoShow} onChange={(e) => setAutoNoShow(e.target.value)} className="w-20 tabular-nums" min={5} max={120} />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t("settings.noShowPolicy")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.noShowPolicyDesc")}</p>
          </div>
          <Select value={policy} onValueChange={setPolicy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep_full">{t("settings.noShowKeepFull")}</SelectItem>
              <SelectItem value="partial_refund">{t("settings.noShowPartial")}</SelectItem>
              <SelectItem value="admin_decides">{t("settings.noShowAdminDecides")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {policy === "partial_refund" && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.noShowRefundPercent")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.noShowRefundPercentDesc")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" value={refundPercent} onChange={(e) => setRefundPercent(e.target.value)} className="w-20 tabular-nums" min={0} max={100} />
                <span className="text-xs text-muted-foreground">%</span>
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
              autoCompleteAfterHours: Number(autoComplete) || 2,
              autoNoShowAfterMinutes: Number(autoNoShow) || 30,
              noShowPolicy: policy,
              noShowRefundPercent: Number(refundPercent) || 0,
            })}
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
