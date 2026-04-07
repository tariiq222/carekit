"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-clinic-settings"
import type { BookingSettings } from "@/lib/api/booking-settings"
import {
  NumRow,
  useAutoSave,
  AdvancedCancellationPanel,
  ReschedulingPanel,
  NoShowPanel,
} from "./advanced-cancellation-card"

type TabId = "policy" | "advanced" | "rescheduling" | "noshow"

interface Props { t: (key: string) => string }

/* ─── Panel: Cancellation Policy ─── */

function CancellationPolicyPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [policyEn, setPolicyEn] = useState(settings.cancellationPolicyEn ?? "")
  const [policyAr, setPolicyAr] = useState(settings.cancellationPolicyAr ?? "")
  const [cancelHours, setCancelHours] = useState(String(settings.freeCancelBeforeHours))

  useEffect(() => {
    setPolicyEn(settings.cancellationPolicyEn ?? "")
    setPolicyAr(settings.cancellationPolicyAr ?? "")
    setCancelHours(String(settings.freeCancelBeforeHours))
  }, [settings])

  const data = {
    freeCancelBeforeHours: Number(cancelHours) || 24,
    cancellationPolicyEn: policyEn,
    cancellationPolicyAr: policyAr,
  }
  const saved = {
    freeCancelBeforeHours: settings.freeCancelBeforeHours,
    cancellationPolicyEn: settings.cancellationPolicyEn ?? "",
    cancellationPolicyAr: settings.cancellationPolicyAr ?? "",
  }
  const { isDirty, scheduleSave } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.cancelHours")} desc={t("settings.cancelHoursDesc")} value={cancelHours}
            onChange={(v) => { setCancelHours(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="space-y-2 pt-3 pb-2">
          <Label>{t("settings.policyTextEn")}</Label>
          <Textarea value={policyEn} rows={3} placeholder="Cancellation policy displayed to patients..."
            onChange={(e) => { setPolicyEn(e.target.value); scheduleSave() }} />
        </CardContent></Card>
        <Card className="shadow-sm bg-surface"><CardContent className="space-y-2 pt-3 pb-2">
          <Label>{t("settings.policyTextAr")}</Label>
          <Textarea value={policyAr} rows={3} dir="rtl" placeholder="سياسة الإلغاء المعروضة للمرضى..."
            onChange={(e) => { setPolicyAr(e.target.value); scheduleSave() }} />
        </CardContent></Card>
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending || !isDirty} onClick={() => onSave(data)}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export function CancellationTab({ t }: Props) {
  const { data: settings, isLoading } = useBookingSettings()
  const mutation = useBookingSettingsMutation()
  const [activeTab, setActiveTab] = useState<TabId>("policy")

  const handleSave = (data: Record<string, unknown>) =>
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "policy",       label: t("settings.cancellationPolicy"),   desc: t("settings.cancellationDesc") },
    { id: "advanced",     label: t("settings.advancedCancellation"), desc: t("settings.freeRefundTypeDesc") },
    { id: "rescheduling", label: t("settings.rescheduling"),         desc: t("settings.patientCanRescheduleDesc") },
    { id: "noshow",       label: t("settings.noShow"),               desc: t("settings.autoCompleteAfterDesc") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.cancellationPolicy")}
            </p>
          </div>
          <div className="flex-1 p-3 space-y-1.5">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 cursor-pointer select-none transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                )}
              >
                <p className="text-sm font-medium truncate leading-tight">
                  {tab.label}
                </p>
                {activeTab === tab.id && (
                  <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">
                    {tab.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {settings && activeTab === "policy" && (
            <CancellationPolicyPanel settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />
          )}
          {settings && activeTab === "advanced" && (
            <AdvancedCancellationPanel settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />
          )}
          {settings && activeTab === "rescheduling" && (
            <ReschedulingPanel settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />
          )}
          {settings && activeTab === "noshow" && (
            <NoShowPanel settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />
          )}
        </div>
      </div>
    </Card>
  )
}
