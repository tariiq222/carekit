"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { type BookingSettings } from "@/lib/api/booking-settings"
import type { BookingFlowOrder } from "@/lib/api/clinic-settings"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"
import { useBookingSettings, useBookingSettingsMutation, useBookingFlowOrder, useBookingFlowOrderMutation, usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-clinic-settings"
import { ReschedulingCard } from "./rescheduling-card"
import { NoShowCard } from "./noshow-card"
import { RemindersCard } from "./reminders-card"
import { WalkInCard } from "./walk-in-card"
import { WaitlistCard } from "./waitlist-card"
import { RecurringCard } from "./recurring-card"

/* ─── Flow Order Card ─── */
function FlowOrderCard({ t }: { t: (key: string) => string }) {
  const { data: flowOrder, isLoading } = useBookingFlowOrder()
  const mutation = useBookingFlowOrderMutation()

  const [selected, setSelected] = useState<BookingFlowOrder>("service_first")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flowOrder) setSelected(flowOrder)
  }, [flowOrder])

  function handleSave() {
    mutation.mutate(selected, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.booking.flowOrder.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <RadioGroup
            value={selected}
            onValueChange={(v) => setSelected(v as BookingFlowOrder)}
            className="space-y-3"
          >
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-surface-muted transition-colors">
              <RadioGroupItem value="service_first" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("settings.booking.flowOrder.serviceFirst")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.flowOrder.serviceFirstDesc")}</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-surface-muted transition-colors">
              <RadioGroupItem value="practitioner_first" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("settings.booking.flowOrder.practitionerFirst")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.flowOrder.practitionerFirstDesc")}</p>
              </div>
            </label>
          </RadioGroup>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={mutation.isPending || isLoading}
        >
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ─── Payment Methods Card ─── */

type PaymentKey = "paymentMoyasarEnabled" | "paymentAtClinicEnabled"

function PaymentMethodsCard({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = usePaymentSettings()
  const mutation = usePaymentSettingsMutation()
  const toggle = (key: PaymentKey, value: boolean) =>
    mutation.mutate({ [key]: value }, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.booking.paymentMethods.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Skeleton className="h-20 w-full" /> : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.booking.paymentMethods.moyasar")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.paymentMethods.moyasarDesc")}</p>
              </div>
              <Switch checked={data?.paymentMoyasarEnabled ?? false} onCheckedChange={(v) => toggle("paymentMoyasarEnabled", v)} disabled={mutation.isPending} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.booking.paymentMethods.atClinic")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.paymentMethods.atClinicDesc")}</p>
              </div>
              <Switch checked={data?.paymentAtClinicEnabled ?? true} onCheckedChange={(v) => toggle("paymentAtClinicEnabled", v)} disabled={mutation.isPending} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function BookingTab({ configMap, onSave, isPending, t }: Props) {
  const { data: settings, isLoading: settingsLoading } = useBookingSettings()
  const settingsMut = useBookingSettingsMutation()
  const handleSettingsSave = (data: Record<string, unknown>) =>
    settingsMut.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WhiteLabelBookingCard configMap={configMap} onSave={onSave} isPending={isPending} t={t} />
      <BookingPoliciesCard settings={settings} isLoading={settingsLoading} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
      {settings && !settingsLoading && (
        <>
          <WalkInCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          <WaitlistCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          <RecurringCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          <FlowOrderCard t={t} />
          <PaymentMethodsCard t={t} />
          <ReschedulingCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          <NoShowCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          <RemindersCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
        </>
      )}
    </div>
  )
}

/* ─── White Label Booking Card (existing) ─── */

function WhiteLabelBookingCard({ configMap, onSave, isPending, t }: Props) {
  const [prepayment, setPrepayment] = useState(false)
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState("")
  const [slotDuration, setSlotDuration] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrepayment(configMap.prepayment_required === "true")
    setAutoConfirm(configMap.auto_confirm_bookings === "true")
    setMaxAdvanceDays(configMap.max_advance_booking_days ?? "30")
    setSlotDuration(configMap.default_slot_duration ?? "30")
  }, [configMap])

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">{t("settings.tabs.booking")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <SwitchRow
          title={t("settings.prepayment")}
          desc={t("settings.prepaymentDesc")}
          checked={prepayment}
          onChange={setPrepayment}
        />
        <Separator />
        <SwitchRow
          title={t("settings.autoConfirm")}
          desc={t("settings.autoConfirmDesc")}
          checked={autoConfirm}
          onChange={setAutoConfirm}
        />
        <Separator />
        <NumberRow
          label={t("settings.slotDuration")}
          desc={t("settings.slotDurationDesc")}
          value={slotDuration}
          onChange={setSlotDuration}
          unit="min"
        />
        <Separator />
        <NumberRow
          label={t("settings.maxAdvanceDays")}
          desc={t("settings.maxAdvanceDaysDesc")}
          value={maxAdvanceDays}
          onChange={setMaxAdvanceDays}
          unit="days"
        />
        <div className="flex justify-end pt-5">
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              onSave([
                { key: "prepayment_required", value: String(prepayment), type: "boolean" },
                { key: "auto_confirm_bookings", value: String(autoConfirm), type: "boolean" },
                { key: "default_slot_duration", value: slotDuration, type: "number" },
                { key: "max_advance_booking_days", value: maxAdvanceDays, type: "number" },
              ])
            }
          >
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Booking Policies Card (BookingSettings API) ─── */
function BookingPoliciesCard({ settings, isLoading, onSave, isPending: isSaving, t }: {
  settings: BookingSettings | undefined
  isLoading: boolean
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  t: (key: string) => string
}) {
  const [leadMinutes, setLeadMinutes] = useState("")
  const [paymentTimeout, setPaymentTimeout] = useState("60")
  const [bufferMin, setBufferMin] = useState("0")

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeadMinutes(String(settings.minBookingLeadMinutes ?? 0))
      setPaymentTimeout(String(settings.paymentTimeoutMinutes ?? 60))
      setBufferMin(String(settings.bufferMinutes ?? 0))
    }
  }, [settings])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">
          {t("settings.bookingPolicies")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        <NumberRow
          label={t("settings.minBookingLead")}
          desc={t("settings.minBookingLeadDesc")}
          value={leadMinutes}
          onChange={setLeadMinutes}
          unit="min"
        />
        <Separator />
        <NumberRow
          label={t("settings.paymentTimeout")}
          desc={t("settings.paymentTimeoutDesc")}
          value={paymentTimeout}
          onChange={setPaymentTimeout}
          unit="min"
        />
        <Separator />
        <NumberRow
          label={t("settings.bufferMinutes")}
          desc={t("settings.bufferMinutesDesc")}
          value={bufferMin}
          onChange={setBufferMin}
          unit="min"
        />
        <div className="flex justify-end pt-5">
          <Button
            size="sm"
            disabled={isSaving}
            onClick={() => onSave({
              minBookingLeadMinutes: Number(leadMinutes) || 0,
              paymentTimeoutMinutes: Number(paymentTimeout) || 60,
              bufferMinutes: Number(bufferMin) || 0,
            })}
          >
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
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function NumberRow({ label, desc, value, onChange, unit }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; unit: string
}) {
  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 tabular-nums"
          min={0}
        />
        <span className="text-xs text-muted-foreground w-6">{unit}</span>
      </div>
    </div>
  )
}