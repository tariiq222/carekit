// EXCEPTION: single settings card with inline form; no meaningful sub-components, approved 2026-04-24
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Input } from "@carekit/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@carekit/ui"
import type { BookingSettings } from "@/lib/api/booking-settings"

/* ─── Shared sub-rows ─── */

export function SwitchRow({ label, desc, checked, onChange }: {
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

export function NumRow({ label, desc, value, onChange, unit }: {
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

export function SelectRow({ label, desc, value, onChange, options }: {
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

export function useAutoSave(
  data: Record<string, unknown>,
  savedData: Record<string, unknown>,
  onSave: (d: Record<string, unknown>) => void,
  textDebounceMs = 1500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep a ref to always have the latest data without stale closure issues
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const isDirty = JSON.stringify(data) !== JSON.stringify(savedData)

  // Debounced save — used for text fields
  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSave(dataRef.current), textDebounceMs)
  }, [onSave, textDebounceMs])

  // Immediate save — used for switches/selects
  // Accepts optional override so callers can pass the latest value directly
  const saveNow = useCallback((override?: Record<string, unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onSave(override ?? dataRef.current)
  }, [onSave])

  // Button-safe wrapper — no args, always saves current dataRef
  const saveNowBtn = useCallback(() => saveNow(), [saveNow])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { isDirty, scheduleSave, saveNow, saveNowBtn, dataRef }
}

/* ─── Panel: Advanced Cancellation Rules ─── */

export function AdvancedCancellationPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [freeRefund, setFreeRefund] = useState(settings.freeCancelRefundType)
  const [lateRefund, setLateRefund] = useState(settings.lateCancelRefundType)
  const [latePercent, setLatePercent] = useState(String(settings.lateCancelRefundPercent))
  const [adminDirect, setAdminDirect] = useState(settings.adminCanDirectCancel)
  const [clientPending, setClientPending] = useState(settings.clientCanCancelPending)
  const [reviewTimeout, setReviewTimeout] = useState(String(settings.cancellationReviewTimeoutHours))

  useEffect(() => {
    setFreeRefund(settings.freeCancelRefundType)
    setLateRefund(settings.lateCancelRefundType)
    setLatePercent(String(settings.lateCancelRefundPercent))
    setAdminDirect(settings.adminCanDirectCancel)
    setClientPending(settings.clientCanCancelPending)
    setReviewTimeout(String(settings.cancellationReviewTimeoutHours))
  }, [settings])

  const data = {
    freeCancelRefundType: freeRefund,
    lateCancelRefundType: lateRefund,
    lateCancelRefundPercent: Number(latePercent) || 0,
    adminCanDirectCancel: adminDirect,
    clientCanCancelPending: clientPending,
    cancellationReviewTimeoutHours: Number(reviewTimeout) || 48,
  }
  const saved = {
    freeCancelRefundType: settings.freeCancelRefundType,
    lateCancelRefundType: settings.lateCancelRefundType,
    lateCancelRefundPercent: settings.lateCancelRefundPercent,
    adminCanDirectCancel: settings.adminCanDirectCancel,
    clientCanCancelPending: settings.clientCanCancelPending,
    cancellationReviewTimeoutHours: settings.cancellationReviewTimeoutHours,
  }
  const { isDirty, scheduleSave, saveNow, saveNowBtn, dataRef } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.freeRefundType")} desc={t("settings.freeRefundTypeDesc")} value={freeRefund}
            onChange={(v) => { setFreeRefund(v); saveNow({ ...dataRef.current, freeCancelRefundType: v }) }} options={[
              { value: "full", label: t("settings.refundFull") },
              { value: "partial", label: t("settings.refundPartial") },
              { value: "none", label: t("settings.refundNone") },
            ]} />
        </CardContent></Card>
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.lateRefundType")} desc={t("settings.lateRefundTypeDesc")} value={lateRefund}
            onChange={(v) => { setLateRefund(v); saveNow({ ...dataRef.current, lateCancelRefundType: v }) }} options={[
              { value: "full", label: t("settings.refundFull") },
              { value: "partial", label: t("settings.refundPartial") },
              { value: "none", label: t("settings.refundNone") },
            ]} />
        </CardContent></Card>
      </div>
      {lateRefund === "partial" && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
            <NumRow label={t("settings.lateRefundPercent")} desc={t("settings.lateRefundPercentDesc")} value={latePercent}
              onChange={(v) => { setLatePercent(v); scheduleSave() }} unit="%" />
          </CardContent></Card>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.adminDirectCancel")} desc={t("settings.adminDirectCancelDesc")} checked={adminDirect}
            onChange={(v) => { setAdminDirect(v); saveNow({ ...dataRef.current, adminCanDirectCancel: v }) }} />
        </CardContent></Card>
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.clientCancelPending")} desc={t("settings.clientCancelPendingDesc")} checked={clientPending}
            onChange={(v) => { setClientPending(v); saveNow({ ...dataRef.current, clientCanCancelPending: v }) }} />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.reviewTimeout")} desc={t("settings.reviewTimeoutDesc")} value={reviewTimeout}
            onChange={(v) => { setReviewTimeout(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending || !isDirty} onClick={saveNowBtn}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Panel: Rescheduling ─── */

export function ReschedulingPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [canReschedule, setCanReschedule] = useState(settings.clientCanReschedule)
  const [beforeHours, setBeforeHours] = useState(String(settings.rescheduleBeforeHours))
  const [maxCount, setMaxCount] = useState(String(settings.maxReschedulesPerBooking))

  useEffect(() => {
    setCanReschedule(settings.clientCanReschedule)
    setBeforeHours(String(settings.rescheduleBeforeHours))
    setMaxCount(String(settings.maxReschedulesPerBooking))
  }, [settings])

  const data = {
    clientCanReschedule: canReschedule,
    rescheduleBeforeHours: Number(beforeHours) || 12,
    maxReschedulesPerBooking: Number(maxCount) || 2,
  }
  const saved = {
    clientCanReschedule: settings.clientCanReschedule,
    rescheduleBeforeHours: settings.rescheduleBeforeHours,
    maxReschedulesPerBooking: settings.maxReschedulesPerBooking,
  }
  const { isDirty, scheduleSave, saveNow, saveNowBtn, dataRef } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SwitchRow label={t("settings.clientCanReschedule")} desc={t("settings.clientCanRescheduleDesc")} checked={canReschedule}
            onChange={(v) => { setCanReschedule(v); saveNow({ ...dataRef.current, clientCanReschedule: v }) }} />
        </CardContent></Card>
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.rescheduleBeforeHours")} desc={t("settings.rescheduleBeforeHoursDesc")} value={beforeHours}
            onChange={(v) => { setBeforeHours(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.maxReschedules")} desc={t("settings.maxReschedulesDesc")} value={maxCount}
            onChange={(v) => { setMaxCount(v); scheduleSave() }} unit="x" />
        </CardContent></Card>
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending || !isDirty} onClick={saveNowBtn}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Panel: No-Show ─── */

export function NoShowPanel({ settings, onSave, isPending, t }: {
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
  const { isDirty, scheduleSave, saveNow, saveNowBtn, dataRef } = useAutoSave(data, saved, onSave)

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.autoCompleteAfter")} desc={t("settings.autoCompleteAfterDesc")} value={autoComplete}
            onChange={(v) => { setAutoComplete(v); scheduleSave() }} unit="h" />
        </CardContent></Card>
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <NumRow label={t("settings.autoNoShowAfter")} desc={t("settings.autoNoShowAfterDesc")} value={autoNoShow}
            onChange={(v) => { setAutoNoShow(v); scheduleSave() }} unit="min" />
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
          <SelectRow label={t("settings.noShowPolicy")} desc={t("settings.noShowPolicyDesc")} value={policy}
            onChange={(v) => { setPolicy(v); saveNow({ ...dataRef.current, noShowPolicy: v }) }} options={[
              { value: "keep_full", label: t("settings.noShowKeepFull") },
              { value: "partial_refund", label: t("settings.noShowPartial") },
              { value: "admin_decides", label: t("settings.noShowAdminDecides") },
            ]} />
        </CardContent></Card>
        {policy === "partial_refund" && (
          <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
            <NumRow label={t("settings.noShowRefundPercent")} desc={t("settings.noShowRefundPercentDesc")} value={refundPercent}
              onChange={(v) => { setRefundPercent(v); scheduleSave() }} unit="%" />
          </CardContent></Card>
        )}
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending || !isDirty} onClick={saveNowBtn}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}
