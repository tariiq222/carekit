"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { BookingFlowOrder } from "@/lib/api/clinic-settings"
import { RECURRING_PATTERNS } from "@/lib/api/booking-settings"
import { useBookingSettings, useBookingSettingsMutation, useBookingFlowOrder, useBookingFlowOrderMutation } from "@/hooks/use-clinic-settings"

type TabId = "policies" | "walkin" | "waitlist" | "recurring" | "floworder"

/* ─── Sub-components ─── */
function NumberRow({ label, desc, value, onChange, unit, min = 0 }: {
  label: string; desc: string; value: string; onChange: (v: string) => void; unit: string; min?: number
}) {
  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="w-20 tabular-nums" min={min} />
        <span className="text-xs text-muted-foreground w-6">{unit}</span>
      </div>
    </div>
  )
}

function SwitchRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/* ─── Main Component ─── */
interface Props { t: (key: string) => string }

export function BookingTab({ t }: Props) {
  const { data: settings, isLoading: settingsLoading } = useBookingSettings()
  const settingsMut = useBookingSettingsMutation()
  const { data: flowOrder, isLoading: flowLoading } = useBookingFlowOrder()
  const flowMut = useBookingFlowOrderMutation()

  const [activeTab, setActiveTab] = useState<TabId>("policies")

  // Policies
  const [leadMinutes, setLeadMinutes] = useState("0")
  const [paymentTimeout, setPaymentTimeout] = useState("60")
  const [bufferMin, setBufferMin] = useState("0")
  const [maxAdvanceDays, setMaxAdvanceDays] = useState("60")

  // Walk-in
  const [allowWalkIn, setAllowWalkIn] = useState(false)
  const [walkInPaymentRequired, setWalkInPaymentRequired] = useState(false)

  // Waitlist
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [waitlistMaxPerSlot, setWaitlistMaxPerSlot] = useState("5")
  const [waitlistAutoNotify, setWaitlistAutoNotify] = useState(true)

  // Recurring
  const [allowRecurring, setAllowRecurring] = useState(false)
  const [maxRecurrences, setMaxRecurrences] = useState("12")
  const [allowedPatterns, setAllowedPatterns] = useState<string[]>(["weekly", "biweekly"])
  const [adminCanBookOutsideHours, setAdminCanBookOutsideHours] = useState(false)

  // Flow order
  const [flowOrderVal, setFlowOrderVal] = useState<BookingFlowOrder>("service_first")

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeadMinutes(String(settings.minBookingLeadMinutes ?? 0))
      setPaymentTimeout(String(settings.paymentTimeoutMinutes ?? 60))
      setBufferMin(String(settings.bufferMinutes ?? 0))
      setMaxAdvanceDays(String(settings.maxAdvanceBookingDays ?? 60))
      setAllowWalkIn(settings.allowWalkIn)
      setWalkInPaymentRequired(settings.walkInPaymentRequired)
      setWaitlistEnabled(settings.waitlistEnabled)
      setWaitlistMaxPerSlot(String(settings.waitlistMaxPerSlot))
      setWaitlistAutoNotify(settings.waitlistAutoNotify)
      setAllowRecurring(settings.allowRecurring)
      setMaxRecurrences(String(settings.maxRecurrences ?? 12))
      setAllowedPatterns(settings.allowedRecurringPatterns ?? ["weekly", "biweekly"])
      setAdminCanBookOutsideHours(settings.adminCanBookOutsideHours ?? false)
    }
  }, [settings])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flowOrder) setFlowOrderVal(flowOrder)
  }, [flowOrder])

  const handleSettingsSave = (data: Record<string, unknown>) =>
    settingsMut.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  /* ── Loading skeleton ── */
  if (settingsLoading || flowLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "policies", label: t("settings.bookingPolicies"), desc: t("settings.minBookingLeadDesc") },
    { id: "walkin", label: t("settings.walkIn"), desc: t("settings.allowWalkInDesc") },
    { id: "waitlist", label: t("settings.waitlist"), desc: t("settings.waitlistEnabledDesc") },
    { id: "recurring", label: t("settings.recurring"), desc: t("settings.allowRecurringDesc") },
    { id: "floworder", label: t("settings.booking.flowOrder.title"), desc: t("settings.booking.flowOrder.serviceFirstDesc") },
  ]

  const isSaving = settingsMut.isPending || flowMut.isPending

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar Tabs ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("settings.bookingPolicies")}
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

        {/* ── Content Panel ── */}
        <div className="flex-1 p-6">
          {activeTab === "policies" && (
            <div className="space-y-0 max-w-lg">
              <NumberRow label={t("settings.minBookingLead")} desc={t("settings.minBookingLeadDesc")} value={leadMinutes} onChange={setLeadMinutes} unit="min" />
              <Separator />
              <NumberRow label={t("settings.paymentTimeout")} desc={t("settings.paymentTimeoutDesc")} value={paymentTimeout} onChange={setPaymentTimeout} unit="min" min={5} />
              <Separator />
              <NumberRow label={t("settings.bufferMinutes")} desc={t("settings.bufferMinutesDesc")} value={bufferMin} onChange={setBufferMin} unit="min" />
              <Separator />
              <NumberRow label={t("settings.maxAdvanceDays")} desc={t("settings.maxAdvanceDaysDesc")} value={maxAdvanceDays} onChange={setMaxAdvanceDays} unit="days" />
              <Separator />
              <div className="py-4">
                <SwitchRow label={t("settings.adminCanBookOutsideHours")} desc={t("settings.adminCanBookOutsideHoursDesc")} checked={adminCanBookOutsideHours} onChange={setAdminCanBookOutsideHours} />
              </div>
              <div className="flex justify-end pt-5">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
                  minBookingLeadMinutes: Number(leadMinutes) || 0,
                  paymentTimeoutMinutes: Math.max(5, Number(paymentTimeout) || 60),
                  bufferMinutes: Number(bufferMin) || 0,
                  maxAdvanceBookingDays: Number(maxAdvanceDays) || 60,
                  adminCanBookOutsideHours,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "walkin" && (
            <div className="space-y-4 max-w-lg">
              <SwitchRow label={t("settings.allowWalkIn")} desc={t("settings.allowWalkInDesc")} checked={allowWalkIn} onChange={setAllowWalkIn} />
              {allowWalkIn && (
                <>
                  <Separator />
                  <SwitchRow label={t("settings.walkInPaymentRequired")} desc={t("settings.walkInPaymentRequiredDesc")} checked={walkInPaymentRequired} onChange={setWalkInPaymentRequired} />
                </>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({ allowWalkIn, walkInPaymentRequired })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "waitlist" && (
            <div className="space-y-4 max-w-lg">
              <SwitchRow label={t("settings.waitlistEnabled")} desc={t("settings.waitlistEnabledDesc")} checked={waitlistEnabled} onChange={setWaitlistEnabled} />
              {waitlistEnabled && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t("settings.waitlistMaxPerSlot")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings.waitlistMaxPerSlotDesc")}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input type="number" value={waitlistMaxPerSlot} onChange={(e) => setWaitlistMaxPerSlot(e.target.value)} className="w-20 tabular-nums" min={1} max={50} />
                    </div>
                  </div>
                  <Separator />
                  <SwitchRow label={t("settings.waitlistAutoNotify")} desc={t("settings.waitlistAutoNotifyDesc")} checked={waitlistAutoNotify} onChange={setWaitlistAutoNotify} />
                </>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
                  waitlistEnabled, waitlistMaxPerSlot: Number(waitlistMaxPerSlot) || 5, waitlistAutoNotify,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "recurring" && (
            <div className="space-y-4 max-w-lg">
              <SwitchRow label={t("settings.allowRecurring")} desc={t("settings.allowRecurringDesc")} checked={allowRecurring} onChange={setAllowRecurring} />
              {allowRecurring && (
                <>
                  <Separator />
                  <NumberRow label={t("settings.maxRecurrences")} desc={t("settings.maxRecurrencesDesc")} value={maxRecurrences} onChange={setMaxRecurrences} unit="x" min={1} />
                  <Separator />
                  <div className="py-2">
                    <p className="text-sm font-medium text-foreground mb-1">{t("settings.allowedRecurringPatterns")}</p>
                    <p className="text-xs text-muted-foreground mb-3">{t("settings.allowedRecurringPatternsDesc")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {RECURRING_PATTERNS.map((p) => (
                        <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={allowedPatterns.includes(p.value)}
                            onCheckedChange={(checked) => {
                              setAllowedPatterns(prev =>
                                checked
                                  ? [...prev, p.value]
                                  : prev.filter(v => v !== p.value)
                              )
                            }}
                          />
                          <span className="text-sm">{p.labelAr}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-end">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
                  allowRecurring,
                  maxRecurrences: Number(maxRecurrences) || 12,
                  allowedRecurringPatterns: allowedPatterns,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "floworder" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <p className="text-sm font-semibold">{t("settings.booking.flowOrder.title")}</p>
              </div>
              <Separator />
              <RadioGroup value={flowOrderVal} onValueChange={(v) => setFlowOrderVal(v as BookingFlowOrder)} className="space-y-3">
                {(["service_first", "practitioner_first", "both"] as const).map((val) => (
                  <label key={val} className="flex items-start gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-surface-muted transition-colors">
                    <RadioGroupItem value={val} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirst" : val === "practitioner_first" ? "practitionerFirst" : "both"}`)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirstDesc" : val === "practitioner_first" ? "practitionerFirstDesc" : "bothDesc"}`)}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <div className="flex justify-end pt-2">
                <Button size="sm" disabled={isSaving} onClick={() => flowMut.mutate(flowOrderVal, {
                  onSuccess: () => toast.success(t("settings.saved")),
                  onError: (err: Error) => toast.error(err.message),
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
