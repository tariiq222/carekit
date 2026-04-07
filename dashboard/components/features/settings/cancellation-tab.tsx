"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-clinic-settings"
import type { BookingSettings } from "@/lib/api/booking-settings"

type TabId = "policy" | "advanced" | "rescheduling" | "noshow"

interface Props { t: (key: string) => string }

/* ─── Shared sub-rows ─── */

function SwitchRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NumRow({ label, desc, value, onChange, unit }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; unit?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-20 tabular-nums" min={0} />
        {unit && <span className="text-xs text-muted-foreground w-8">{unit}</span>}
      </div>
    </div>
  )
}

function SelectRow({ label, desc, value, onChange, options }: {
  label: string; desc: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}

/* ─── useAutoSave hook ─── */

function useAutoSave(
  data: Record<string, unknown>,
  savedData: Record<string, unknown>,
  onSave: (d: Record<string, unknown>) => void,
  textDebounceMs = 1500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData)

  // Debounced save — used for text fields triggering this
  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSave(data), textDebounceMs)
  }, [data, onSave, textDebounceMs])

  // Immediate save — used for switches/selects
  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onSave(data)
  }, [data, onSave])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { isDirty, scheduleSave, saveNow }
}

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
  const { isDirty, scheduleSave, saveNow } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.cancelHours")} desc={t("settings.cancelHoursDesc")} value={cancelHours}
            onChange={(v) => { setCancelHours(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="space-y-2 pt-2 pb-2">
          <Label>{t("settings.policyTextEn")}</Label>
          <Textarea value={policyEn} rows={3} placeholder="Cancellation policy displayed to patients..."
            onChange={(e) => { setPolicyEn(e.target.value); scheduleSave() }} />
        </CardContent></Card>
        <Card><CardContent className="space-y-2 pt-2 pb-2">
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

/* ─── Panel: Advanced Cancellation Rules ─── */

function AdvancedCancellationPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [freeRefund, setFreeRefund] = useState(settings.freeCancelRefundType)
  const [lateRefund, setLateRefund] = useState(settings.lateCancelRefundType)
  const [latePercent, setLatePercent] = useState(String(settings.lateCancelRefundPercent))
  const [adminDirect, setAdminDirect] = useState(settings.adminCanDirectCancel)
  const [patientPending, setPatientPending] = useState(settings.patientCanCancelPending)
  const [reviewTimeout, setReviewTimeout] = useState(String(settings.cancellationReviewTimeoutHours))

  useEffect(() => {
    setFreeRefund(settings.freeCancelRefundType)
    setLateRefund(settings.lateCancelRefundType)
    setLatePercent(String(settings.lateCancelRefundPercent))
    setAdminDirect(settings.adminCanDirectCancel)
    setPatientPending(settings.patientCanCancelPending)
    setReviewTimeout(String(settings.cancellationReviewTimeoutHours))
  }, [settings])

  const data = {
    freeCancelRefundType: freeRefund,
    lateCancelRefundType: lateRefund,
    lateCancelRefundPercent: Number(latePercent) || 0,
    adminCanDirectCancel: adminDirect,
    patientCanCancelPending: patientPending,
    cancellationReviewTimeoutHours: Number(reviewTimeout) || 48,
  }
  const saved = {
    freeCancelRefundType: settings.freeCancelRefundType,
    lateCancelRefundType: settings.lateCancelRefundType,
    lateCancelRefundPercent: settings.lateCancelRefundPercent,
    adminCanDirectCancel: settings.adminCanDirectCancel,
    patientCanCancelPending: settings.patientCanCancelPending,
    cancellationReviewTimeoutHours: settings.cancellationReviewTimeoutHours,
  }
  const { isDirty, scheduleSave, saveNow } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.freeRefundType")} desc={t("settings.freeRefundTypeDesc")} value={freeRefund}
            onChange={(v) => { setFreeRefund(v); saveNow() }} options={[
              { value: "full", label: t("settings.refundFull") },
              { value: "partial", label: t("settings.refundPartial") },
              { value: "none", label: t("settings.refundNone") },
            ]} />
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.lateRefundType")} desc={t("settings.lateRefundTypeDesc")} value={lateRefund}
            onChange={(v) => { setLateRefund(v); saveNow() }} options={[
              { value: "full", label: t("settings.refundFull") },
              { value: "partial", label: t("settings.refundPartial") },
              { value: "none", label: t("settings.refundNone") },
            ]} />
        </CardContent></Card>
      </div>
      {lateRefund === "partial" && (
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="pt-2 pb-2">
            <NumRow label={t("settings.lateRefundPercent")} desc={t("settings.lateRefundPercentDesc")} value={latePercent}
              onChange={(v) => { setLatePercent(v); scheduleSave() }} unit="%" />
          </CardContent></Card>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.adminDirectCancel")} desc={t("settings.adminDirectCancelDesc")} checked={adminDirect}
            onChange={(v) => { setAdminDirect(v); saveNow() }} />
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.patientCancelPending")} desc={t("settings.patientCancelPendingDesc")} checked={patientPending}
            onChange={(v) => { setPatientPending(v); saveNow() }} />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.reviewTimeout")} desc={t("settings.reviewTimeoutDesc")} value={reviewTimeout}
            onChange={(v) => { setReviewTimeout(v); scheduleSave() }} unit="h" />
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

/* ─── Panel: Rescheduling ─── */

function ReschedulingPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [canReschedule, setCanReschedule] = useState(settings.patientCanReschedule)
  const [beforeHours, setBeforeHours] = useState(String(settings.rescheduleBeforeHours))
  const [maxCount, setMaxCount] = useState(String(settings.maxReschedulesPerBooking))

  useEffect(() => {
    setCanReschedule(settings.patientCanReschedule)
    setBeforeHours(String(settings.rescheduleBeforeHours))
    setMaxCount(String(settings.maxReschedulesPerBooking))
  }, [settings])

  const data = {
    patientCanReschedule: canReschedule,
    rescheduleBeforeHours: Number(beforeHours) || 12,
    maxReschedulesPerBooking: Number(maxCount) || 2,
  }
  const saved = {
    patientCanReschedule: settings.patientCanReschedule,
    rescheduleBeforeHours: settings.rescheduleBeforeHours,
    maxReschedulesPerBooking: settings.maxReschedulesPerBooking,
  }
  const { isDirty, scheduleSave, saveNow } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.patientCanReschedule")} desc={t("settings.patientCanRescheduleDesc")} checked={canReschedule}
            onChange={(v) => { setCanReschedule(v); saveNow() }} />
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.rescheduleBeforeHours")} desc={t("settings.rescheduleBeforeHoursDesc")} value={beforeHours}
            onChange={(v) => { setBeforeHours(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.maxReschedules")} desc={t("settings.maxReschedulesDesc")} value={maxCount}
            onChange={(v) => { setMaxCount(v); scheduleSave() }} unit="x" />
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

/* ─── Panel: No-Show ─── */

function NoShowPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [autoComplete, setAutoComplete] = useState(String(settings.autoCompleteAfterHours))
  const [autoNoShow, setAutoNoShow] = useState(String(settings.autoNoShowAfterMinutes))
  const [policy, setPolicy] = useState(settings.noShowPolicy)
  const [refundPercent, setRefundPercent] = useState(String(settings.noShowRefundPercent))

  useEffect(() => {
    setAutoComplete(String(settings.autoCompleteAfterHours))
    setAutoNoShow(String(settings.autoNoShowAfterMinutes))
    setPolicy(settings.noShowPolicy)
    setRefundPercent(String(settings.noShowRefundPercent))
  }, [settings])

  const data = {
    autoCompleteAfterHours: Number(autoComplete) || 2,
    autoNoShowAfterMinutes: Number(autoNoShow) || 30,
    noShowPolicy: policy,
    noShowRefundPercent: Number(refundPercent) || 0,
  }
  const saved = {
    autoCompleteAfterHours: settings.autoCompleteAfterHours,
    autoNoShowAfterMinutes: settings.autoNoShowAfterMinutes,
    noShowPolicy: settings.noShowPolicy,
    noShowRefundPercent: settings.noShowRefundPercent,
  }
  const { isDirty, scheduleSave, saveNow } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.autoCompleteAfter")} desc={t("settings.autoCompleteAfterDesc")} value={autoComplete}
            onChange={(v) => { setAutoComplete(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
        <Card><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.autoNoShowAfter")} desc={t("settings.autoNoShowAfterDesc")} value={autoNoShow}
            onChange={(v) => { setAutoNoShow(v); scheduleSave() }} unit="min" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.noShowPolicy")} desc={t("settings.noShowPolicyDesc")} value={policy}
            onChange={(v) => { setPolicy(v); saveNow() }} options={[
              { value: "keep_full", label: t("settings.noShowKeepFull") },
              { value: "partial_refund", label: t("settings.noShowPartial") },
              { value: "admin_decides", label: t("settings.noShowAdminDecides") },
            ]} />
        </CardContent></Card>
        {policy === "partial_refund" && (
          <Card><CardContent className="pt-2 pb-2">
            <NumRow label={t("settings.noShowRefundPercent")} desc={t("settings.noShowRefundPercentDesc")} value={refundPercent}
              onChange={(v) => { setRefundPercent(v); scheduleSave() }} unit="%" />
          </CardContent></Card>
        )}
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
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("settings.cancellationPolicy")}
            </p>
          </div>
          <div className="flex-1 p-2 space-y-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full rounded-lg px-3 py-3 cursor-pointer select-none transition-colors",
                  activeTab === tab.id
                    ? "bg-background border border-border shadow-sm"
                    : "hover:bg-background/60"
                )}
              >
                <p className={cn(
                  "text-sm font-medium truncate leading-tight",
                  activeTab === tab.id ? "text-foreground" : "text-muted-foreground"
                )}>
                  {tab.label}
                </p>
                {activeTab === tab.id && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                    {tab.desc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6 overflow-y-auto bg-surface-muted/40 flex flex-col">
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
