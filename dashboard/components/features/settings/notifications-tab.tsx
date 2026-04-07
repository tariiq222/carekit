"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-clinic-settings"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

type TabId = "channels" | "reminders" | "suggestions"

function SwitchCard({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <Card className="shadow-sm bg-surface">
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          <Switch checked={checked} onCheckedChange={onChange} />
        </div>
      </CardContent>
    </Card>
  )
}

/* ─── Channels Panel ─── */
function ChannelsPanel({ configMap, onSave, isPending, t }: Props) {
  const [notifyBookings, setNotifyBookings] = useState(true)
  const [notifyCancellations, setNotifyCancellations] = useState(true)
  const [notifyProblems, setNotifyProblems] = useState(true)
  const [notifyPayments, setNotifyPayments] = useState(true)
  const [notifyRatings, setNotifyRatings] = useState(true)
  const [notifyReminders, setNotifyReminders] = useState(true)
  const [notifyWaitlist, setNotifyWaitlist] = useState(true)

  useEffect(() => {
    setNotifyBookings(configMap.notify_new_bookings !== "false")
    setNotifyCancellations(configMap.notify_cancellations !== "false")
    setNotifyProblems(configMap.notify_problems !== "false")
    setNotifyPayments(configMap.notify_payments !== "false")
    setNotifyRatings(configMap.notify_ratings !== "false")
    setNotifyReminders(configMap.notify_reminders !== "false")
    setNotifyWaitlist(configMap.notify_waitlist !== "false")
  }, [configMap])

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <SwitchCard label={t("settings.notifyBookings")} desc={t("settings.notifyBookingsDesc")} checked={notifyBookings} onChange={setNotifyBookings} />
        <SwitchCard label={t("settings.notifyCancellations")} desc={t("settings.notifyCancellationsDesc")} checked={notifyCancellations} onChange={setNotifyCancellations} />
        <SwitchCard label={t("settings.notifyReminders")} desc={t("settings.notifyRemindersDesc")} checked={notifyReminders} onChange={setNotifyReminders} />
        <SwitchCard label={t("settings.notifyPayments")} desc={t("settings.notifyPaymentsDesc")} checked={notifyPayments} onChange={setNotifyPayments} />
        <SwitchCard label={t("settings.notifyRatings")} desc={t("settings.notifyRatingsDesc")} checked={notifyRatings} onChange={setNotifyRatings} />
        <SwitchCard label={t("settings.notifyProblems")} desc={t("settings.notifyProblemsDesc")} checked={notifyProblems} onChange={setNotifyProblems} />
        <SwitchCard label={t("settings.notifyWaitlist")} desc={t("settings.notifyWaitlistDesc")} checked={notifyWaitlist} onChange={setNotifyWaitlist} />
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending} onClick={() => onSave([
          { key: "notify_new_bookings", value: String(notifyBookings), type: "boolean" },
          { key: "notify_cancellations", value: String(notifyCancellations), type: "boolean" },
          { key: "notify_problems", value: String(notifyProblems), type: "boolean" },
          { key: "notify_payments", value: String(notifyPayments), type: "boolean" },
          { key: "notify_ratings", value: String(notifyRatings), type: "boolean" },
          { key: "notify_reminders", value: String(notifyReminders), type: "boolean" },
          { key: "notify_waitlist", value: String(notifyWaitlist), type: "boolean" },
        ])}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Reminders Panel ─── */
function RemindersPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [r24h, setR24h] = useState(true)
  const [r1h, setR1h] = useState(true)
  const [interactive, setInteractive] = useState(false)

  useEffect(() => {
    setR24h(settings.reminder24hEnabled)
    setR1h(settings.reminder1hEnabled)
    setInteractive(settings.reminderInteractive)
  }, [settings])

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <SwitchCard label={t("settings.reminder24h")} desc={t("settings.reminder24hDesc")} checked={r24h} onChange={setR24h} />
        <SwitchCard label={t("settings.reminder1h")} desc={t("settings.reminder1hDesc")} checked={r1h} onChange={setR1h} />
        <SwitchCard label={t("settings.reminderInteractive")} desc={t("settings.reminderInteractiveDesc")} checked={interactive} onChange={setInteractive} />
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending} onClick={() => onSave({
          reminder24hEnabled: r24h,
          reminder1hEnabled: r1h,
          reminderInteractive: interactive,
        })}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Suggestions Panel ─── */
function SuggestionsPanel({ settings, onSave, isPending, t }: {
  settings: BookingSettings; onSave: (d: Record<string, unknown>) => void; isPending: boolean; t: (k: string) => string
}) {
  const [suggestAlt, setSuggestAlt] = useState(true)
  const [suggestCount, setSuggestCount] = useState("3")

  useEffect(() => {
    setSuggestAlt(settings.suggestAlternativesOnConflict)
    setSuggestCount(String(settings.suggestAlternativesCount))
  }, [settings])

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        <SwitchCard label={t("settings.suggestAlternatives")} desc={t("settings.suggestAlternativesDesc")} checked={suggestAlt} onChange={setSuggestAlt} />
        {suggestAlt && (
          <Card className="shadow-sm bg-surface">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{t("settings.suggestCount")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("settings.suggestCountDesc")}</p>
                </div>
                <Input type="number" value={suggestCount} onChange={(e) => setSuggestCount(e.target.value)} className="w-20 tabular-nums shrink-0" min={1} max={10} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={isPending} onClick={() => onSave({
          suggestAlternativesOnConflict: suggestAlt,
          suggestAlternativesCount: Number(suggestCount) || 3,
        })}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export function NotificationsTab({ configMap, onSave, isPending, t }: Props) {
  const { data: settings, isLoading } = useBookingSettings()
  const settingsMut = useBookingSettingsMutation()
  const [activeTab, setActiveTab] = useState<TabId>("channels")

  const handleSettingsSave = (data: Record<string, unknown>) =>
    settingsMut.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  if (isLoading) {
    return (
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden">
        <div className="w-64 border-e border-border bg-surface-muted space-y-1 p-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6 space-y-3">
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "channels", label: t("settings.tabs.notifications"), desc: t("settings.notificationsHint") },
    { id: "reminders", label: t("settings.reminders"), desc: t("settings.reminder24hDesc") },
    { id: "suggestions", label: t("settings.suggestions"), desc: t("settings.suggestAlternativesDesc") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.tabs.notifications")}
            </p>
          </div>
          <div role="tablist" className="flex-1 p-3 space-y-1.5">
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
                <p className="text-sm font-medium truncate leading-tight">{tab.label}</p>
                {activeTab === tab.id && (
                  <p className="text-xs mt-0.5 line-clamp-2 leading-tight opacity-80">{tab.desc}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col">
          {activeTab === "channels" && (
            <ChannelsPanel configMap={configMap} onSave={onSave} isPending={isPending} t={t} />
          )}
          {activeTab === "reminders" && settings && (
            <RemindersPanel settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          )}
          {activeTab === "suggestions" && settings && (
            <SuggestionsPanel settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
          )}
        </div>
      </div>
    </Card>
  )
}
