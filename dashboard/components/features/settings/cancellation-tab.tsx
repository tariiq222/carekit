"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface Props {
  t: (key: string) => string
}

export function CancellationTab({ t }: Props) {
  const { data: settings, isLoading } = useBookingSettings()
  const mutation = useBookingSettingsMutation()
  const handleSave = (data: Record<string, unknown>) =>
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-60 w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-60 w-full" /></CardContent></Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {settings && <CancellationPolicyCard settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />}
      {settings && <AdvancedCancellationCard settings={settings} onSave={handleSave} isPending={mutation.isPending} t={t} />}
    </div>
  )
}

/* ─── Policy Text + Display Settings ─── */

import type { BookingSettings } from "@/lib/api/booking-settings"

interface CardProps {
  settings: BookingSettings
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}

function CancellationPolicyCard({ settings, onSave, isPending, t }: CardProps) {
  const [policyEn, setPolicyEn] = useState("")
  const [policyAr, setPolicyAr] = useState("")
  const [cancelHours, setCancelHours] = useState("")
  const [autoRefund, setAutoRefund] = useState(false)

  useEffect(() => {
    setPolicyEn(settings.cancellationPolicyEn ?? "")
    setPolicyAr(settings.cancellationPolicyAr ?? "")
    setCancelHours(String(settings.freeCancelBeforeHours))
    setAutoRefund(settings.freeCancelRefundType === "full")
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.cancellationPolicy")}</CardTitle>
        <CardDescription>{t("settings.cancellationDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <NumRow label={t("settings.cancelHours")} desc={t("settings.cancelHoursDesc")} value={cancelHours} onChange={setCancelHours} unit="h" />
        <Separator />
        <SwitchRow title={t("settings.autoRefund")} desc={t("settings.autoRefundDesc")} checked={autoRefund} onChange={setAutoRefund} />
        <Separator />
        <div className="space-y-2">
          <Label>{t("settings.policyTextEn")}</Label>
          <Textarea value={policyEn} onChange={(e) => setPolicyEn(e.target.value)} rows={3} placeholder="Cancellation policy displayed to patients..." />
        </div>
        <div className="space-y-2">
          <Label>{t("settings.policyTextAr")}</Label>
          <Textarea value={policyAr} onChange={(e) => setPolicyAr(e.target.value)} rows={3} dir="rtl" placeholder="سياسة الإلغاء المعروضة للمرضى..." />
        </div>
        <Separator />
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={() => onSave({
            freeCancelBeforeHours: Number(cancelHours) || 24,
            freeCancelRefundType: autoRefund ? "full" : "none",
            cancellationPolicyEn: policyEn,
            cancellationPolicyAr: policyAr,
          })}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Advanced Cancellation Rules ─── */

function AdvancedCancellationCard({ settings, onSave, isPending, t }: CardProps) {
  const [freeRefund, setFreeRefund] = useState("full")
  const [lateRefund, setLateRefund] = useState("none")
  const [latePercent, setLatePercent] = useState("0")
  const [adminDirect, setAdminDirect] = useState(true)
  const [patientPending, setPatientPending] = useState(true)
  const [reviewTimeout, setReviewTimeout] = useState("48")

  useEffect(() => {
    setFreeRefund(settings.freeCancelRefundType)
    setLateRefund(settings.lateCancelRefundType)
    setLatePercent(String(settings.lateCancelRefundPercent))
    setAdminDirect(settings.adminCanDirectCancel)
    setPatientPending(settings.patientCanCancelPending)
    setReviewTimeout(String(settings.cancellationReviewTimeoutHours))
  }, [settings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("settings.advancedCancellation")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SelectRow label={t("settings.freeRefundType")} desc={t("settings.freeRefundTypeDesc")} value={freeRefund} onChange={setFreeRefund} options={[
          { value: "full", label: t("settings.refundFull") },
          { value: "partial", label: t("settings.refundPartial") },
          { value: "none", label: t("settings.refundNone") },
        ]} />
        <Separator />
        <SelectRow label={t("settings.lateRefundType")} desc={t("settings.lateRefundTypeDesc")} value={lateRefund} onChange={setLateRefund} options={[
          { value: "full", label: t("settings.refundFull") },
          { value: "partial", label: t("settings.refundPartial") },
          { value: "none", label: t("settings.refundNone") },
        ]} />
        {lateRefund === "partial" && (
          <>
            <Separator />
            <NumRow label={t("settings.lateRefundPercent")} desc={t("settings.lateRefundPercentDesc")} value={latePercent} onChange={setLatePercent} unit="%" />
          </>
        )}
        <Separator />
        <SwitchRow title={t("settings.adminDirectCancel")} desc={t("settings.adminDirectCancelDesc")} checked={adminDirect} onChange={setAdminDirect} />
        <Separator />
        <SwitchRow title={t("settings.patientCancelPending")} desc={t("settings.patientCancelPendingDesc")} checked={patientPending} onChange={setPatientPending} />
        <Separator />
        <NumRow label={t("settings.reviewTimeout")} desc={t("settings.reviewTimeoutDesc")} value={reviewTimeout} onChange={setReviewTimeout} unit="h" />
        <Separator />
        <div className="flex justify-end">
          <Button size="sm" disabled={isPending} onClick={() => onSave({
            freeCancelRefundType: freeRefund,
            lateCancelRefundType: lateRefund,
            lateCancelRefundPercent: Number(latePercent) || 0,
            adminCanDirectCancel: adminDirect,
            patientCanCancelPending: patientPending,
            cancellationReviewTimeoutHours: Number(reviewTimeout) || 48,
          })}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Shared sub-components ─── */

function SwitchRow({ title, desc, checked, onChange }: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium text-foreground">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NumRow({ label, desc, value, onChange, unit }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; unit?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      <div className="flex items-center gap-2">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-20 tabular-nums" min={0} />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

function SelectRow({ label, desc, value, onChange, options }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}
