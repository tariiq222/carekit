"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@carekit/ui"
import { Button } from "@carekit/ui"
import { Switch } from "@carekit/ui"
import { Input } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import { RadioGroup, RadioGroupItem } from "@carekit/ui"
import { Checkbox } from "@carekit/ui"
import { cn } from "@/lib/utils"
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
import { RECURRING_PATTERNS } from "@/lib/api/booking-settings"
import { useBookingSettings, useBookingSettingsMutation, useBookingFlowOrder, useBookingFlowOrderMutation } from "@/hooks/use-organization-settings"

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
          <div role="tablist" className="flex-1 p-2 space-y-1">
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

        {/* ── Content Panel ── */}
        <div role="tabpanel" className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">

          {activeTab === "policies" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.minBookingLead")} desc={t("settings.minBookingLeadDesc")} value={leadMinutes} onChange={setLeadMinutes} unit="min" />
                </CardContent></Card>
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.paymentTimeout")} desc={t("settings.paymentTimeoutDesc")} value={paymentTimeout} onChange={setPaymentTimeout} unit="min" min={5} />
                </CardContent></Card>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.bufferMinutes")} desc={t("settings.bufferMinutesDesc")} value={bufferMin} onChange={setBufferMin} unit="min" />
                </CardContent></Card>
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.maxAdvanceDays")} desc={t("settings.maxAdvanceDaysDesc")} value={maxAdvanceDays} onChange={setMaxAdvanceDays} unit="days" />
                </CardContent></Card>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.adminCanBookOutsideHours")} desc={t("settings.adminCanBookOutsideHoursDesc")} checked={adminCanBookOutsideHours} onChange={setAdminCanBookOutsideHours} />
                </CardContent></Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
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
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.allowWalkIn")} desc={t("settings.allowWalkInDesc")} checked={allowWalkIn} onChange={setAllowWalkIn} />
                </CardContent></Card>
                {allowWalkIn && (
                  <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                    <SwitchRow label={t("settings.walkInPaymentRequired")} desc={t("settings.walkInPaymentRequiredDesc")} checked={walkInPaymentRequired} onChange={setWalkInPaymentRequired} />
                  </CardContent></Card>
                )}
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({ allowWalkIn, walkInPaymentRequired })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "waitlist" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.waitlistEnabled")} desc={t("settings.waitlistEnabledDesc")} checked={waitlistEnabled} onChange={setWaitlistEnabled} />
                </CardContent></Card>
                {waitlistEnabled && (
                  <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                    <div className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{t("settings.waitlistMaxPerSlot")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t("settings.waitlistMaxPerSlotDesc")}</p>
                      </div>
                      <Input type="number" value={waitlistMaxPerSlot} onChange={(e) => setWaitlistMaxPerSlot(e.target.value)} className="w-20 tabular-nums shrink-0" min={1} max={50} />
                    </div>
                  </CardContent></Card>
                )}
              </div>
              {waitlistEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                    <SwitchRow label={t("settings.waitlistAutoNotify")} desc={t("settings.waitlistAutoNotifyDesc")} checked={waitlistAutoNotify} onChange={setWaitlistAutoNotify} />
                  </CardContent></Card>
                </div>
              )}
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
                  waitlistEnabled, waitlistMaxPerSlot: Number(waitlistMaxPerSlot) || 5, waitlistAutoNotify,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "recurring" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.allowRecurring")} desc={t("settings.allowRecurringDesc")} checked={allowRecurring} onChange={setAllowRecurring} />
                </CardContent></Card>
                {allowRecurring && (
                  <Card className="shadow-sm bg-surface"><CardContent className="pt-2 pb-2">
                    <NumberRow label={t("settings.maxRecurrences")} desc={t("settings.maxRecurrencesDesc")} value={maxRecurrences} onChange={setMaxRecurrences} unit="x" min={1} />
                  </CardContent></Card>
                )}
              </div>
              {allowRecurring && (
                <div className="grid grid-cols-2 gap-3">
                  <Card className="shadow-sm bg-surface col-span-2"><CardContent className="pt-3 pb-3">
                    <p className="text-sm font-medium text-foreground mb-1">{t("settings.allowedRecurringPatterns")}</p>
                    <p className="text-xs text-muted-foreground mb-3">{t("settings.allowedRecurringPatternsDesc")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {RECURRING_PATTERNS.map((p) => (
                        <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={allowedPatterns.includes(p.value)}
                            onCheckedChange={(checked) => {
                              setAllowedPatterns(prev =>
                                checked ? [...prev, p.value] : prev.filter(v => v !== p.value)
                              )
                            }}
                          />
                          <span className="text-sm">{t(p.labelKey)}</span>
                        </label>
                      ))}
                    </div>
                  </CardContent></Card>
                </div>
              )}
              <div className="flex justify-end mt-auto pt-2">
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
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                {(["service_first", "employee_first", "both"] as const).map((val) => (
                  <Card key={val} className={cn("shadow-sm cursor-pointer transition-all", flowOrderVal === val ? "ring-2 ring-primary bg-primary/5" : "bg-surface hover:bg-surface-muted")}
                    onClick={() => setFlowOrderVal(val)}>
                    <CardContent className="pt-2 pb-2">
                      <div className="flex items-start gap-3 py-2">
                        <RadioGroup value={flowOrderVal} onValueChange={(v) => setFlowOrderVal(v as BookingFlowOrder)}>
                          <RadioGroupItem value={val} />
                        </RadioGroup>
                        <div>
                          <p className="text-sm font-medium text-foreground">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirst" : val === "employee_first" ? "employeeFirst" : "both"}`)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirstDesc" : val === "employee_first" ? "employeeFirstDesc" : "bothDesc"}`)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end mt-auto pt-2">
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
