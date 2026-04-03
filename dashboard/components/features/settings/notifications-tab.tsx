"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-clinic-settings"
import { RemindersCard } from "./reminders-card"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

export function NotificationsTab({ configMap, onSave, isPending, t }: Props) {
  const { data: settings } = useBookingSettings()
  const settingsMut = useBookingSettingsMutation()
  const handleSettingsSave = (data: Record<string, unknown>) =>
    settingsMut.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
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

  const handleSave = () =>
    onSave([
      { key: "notify_new_bookings", value: String(notifyBookings), type: "boolean" },
      { key: "notify_cancellations", value: String(notifyCancellations), type: "boolean" },
      { key: "notify_problems", value: String(notifyProblems), type: "boolean" },
      { key: "notify_payments", value: String(notifyPayments), type: "boolean" },
      { key: "notify_ratings", value: String(notifyRatings), type: "boolean" },
      { key: "notify_reminders", value: String(notifyReminders), type: "boolean" },
      { key: "notify_waitlist", value: String(notifyWaitlist), type: "boolean" },
    ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("settings.tabs.notifications")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("settings.notificationsHint")}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ── Bookings ── */}
          <CategorySection title={t("settings.notifyCategory.bookings")}>
            <Row
              title={t("settings.notifyBookings")}
              desc={t("settings.notifyBookingsDesc")}
              checked={notifyBookings}
              onChange={setNotifyBookings}
            />
            <Separator />
            <Row
              title={t("settings.notifyCancellations")}
              desc={t("settings.notifyCancellationsDesc")}
              checked={notifyCancellations}
              onChange={setNotifyCancellations}
            />
            <Separator />
            <Row
              title={t("settings.notifyReminders")}
              desc={t("settings.notifyRemindersDesc")}
              checked={notifyReminders}
              onChange={setNotifyReminders}
            />
          </CategorySection>

          <Separator className="my-2" />

          {/* ── Financial ── */}
          <CategorySection title={t("settings.notifyCategory.financial")}>
            <Row
              title={t("settings.notifyPayments")}
              desc={t("settings.notifyPaymentsDesc")}
              checked={notifyPayments}
              onChange={setNotifyPayments}
            />
          </CategorySection>

          <Separator className="my-2" />

          {/* ── Ratings & Reports ── */}
          <CategorySection title={t("settings.notifyCategory.ratings")}>
            <Row
              title={t("settings.notifyRatings")}
              desc={t("settings.notifyRatingsDesc")}
              checked={notifyRatings}
              onChange={setNotifyRatings}
            />
            <Separator />
            <Row
              title={t("settings.notifyProblems")}
              desc={t("settings.notifyProblemsDesc")}
              checked={notifyProblems}
              onChange={setNotifyProblems}
            />
          </CategorySection>

          <Separator className="my-2" />

          {/* ── Other ── */}
          <CategorySection title={t("settings.notifyCategory.other")}>
            <Row
              title={t("settings.notifyWaitlist")}
              desc={t("settings.notifyWaitlistDesc")}
              checked={notifyWaitlist}
              onChange={setNotifyWaitlist}
            />
          </CategorySection>

          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={isPending} onClick={handleSave}>
              {t("settings.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Reminders Card ── */}
      {settings && (
        <RemindersCard
          settings={settings}
          onSave={handleSettingsSave}
          isPending={settingsMut.isPending}
          t={t}
        />
      )}
    </div>
  )
}

function CategorySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Row({ title, desc, checked, onChange }: {
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
