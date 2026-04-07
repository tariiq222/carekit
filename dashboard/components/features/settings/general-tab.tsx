"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { WhiteLabelConfigMap } from "@/lib/types/whitelabel"

interface Props {
  configMap: WhiteLabelConfigMap
  onSave: (configs: { key: string; value: string; type?: string }[]) => void
  isPending: boolean
  t: (key: string) => string
}

type TabId = "contact" | "regional"

const WEEK_START_OPTIONS = [
  { value: "sunday", label: "الأحد (Sunday)" },
  { value: "monday", label: "الاثنين (Monday)" },
]

const DATE_FORMAT_OPTIONS = [
  { value: "Y-m-d", label: "2026-03-24 (Y-m-d)" },
  { value: "d/m/Y", label: "24/03/2026 (d/m/Y)" },
  { value: "m/d/Y", label: "03/24/2026 (m/d/Y)" },
]

const TIME_FORMAT_OPTIONS = [
  { value: "24h", label: "24 ساعة (24h)" },
  { value: "12h", label: "12 ساعة (12h)" },
]

const TIMEZONE_OPTIONS = [
  { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
  { value: "Asia/Kuwait", label: "Asia/Kuwait (UTC+3)" },
  { value: "Asia/Bahrain", label: "Asia/Bahrain (UTC+3)" },
  { value: "Asia/Qatar", label: "Asia/Qatar (UTC+3)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (UTC+2)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
  { value: "America/New_York", label: "America/New_York (UTC-5)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (UTC+3)" },
  { value: "Asia/Amman", label: "Asia/Amman (UTC+3)" },
  { value: "Asia/Beirut", label: "Asia/Beirut (UTC+2)" },
  { value: "Asia/Baghdad", label: "Asia/Baghdad (UTC+3)" },
]

export function GeneralTab({ configMap, onSave, isPending, t }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("contact")

  const [clinicEmail, setClinicEmail] = useState("")
  const [clinicPhone, setClinicPhone] = useState("")
  const [clinicAddress, setClinicAddress] = useState("")
  const [weekStartDay, setWeekStartDay] = useState("sunday")
  const [dateFormat, setDateFormat] = useState("Y-m-d")
  const [timeFormat, setTimeFormat] = useState("24h")
  const [clinicTimezone, setClinicTimezone] = useState("Asia/Riyadh")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClinicEmail(configMap.contact_email ?? "")
    setClinicPhone(configMap.contact_phone ?? "")
    setClinicAddress(configMap.address ?? "")
    setWeekStartDay(configMap.week_start_day ?? "sunday")
    setDateFormat(configMap.date_format ?? "Y-m-d")
    setTimeFormat(configMap.time_format ?? "24h")
    setClinicTimezone(configMap.timezone ?? "Asia/Riyadh")
  }, [configMap])

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "contact", label: t("settings.tabs.general"), desc: t("settings.clinicEmail") },
    { id: "regional", label: t("settings.regionalSettings"), desc: t("settings.weekStartDay") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("settings.tabs.general")}
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
          {activeTab === "contact" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.clinicEmail")}</Label>
                    <Input type="email" value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} />
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.clinicPhone")}</Label>
                    <Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
                  </CardContent>
                </Card>
              </div>
              <Card className="shadow-sm bg-surface">
                <CardContent className="space-y-2 pt-3 pb-3">
                  <Label>{t("settings.clinicAddress")}</Label>
                  <Input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} />
                </CardContent>
              </Card>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isPending} onClick={() => onSave([
                  { key: "contact_email", value: clinicEmail },
                  { key: "contact_phone", value: clinicPhone },
                  { key: "address", value: clinicAddress },
                ])}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "regional" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.weekStartDay")}</Label>
                    <Select value={weekStartDay} onValueChange={setWeekStartDay}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEK_START_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.dateFormat")}</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATE_FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.timeFormat")}</Label>
                    <Select value={timeFormat} onValueChange={setTimeFormat}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIME_FORMAT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-surface">
                  <CardContent className="space-y-2 pt-3 pb-3">
                    <Label>{t("settings.clinicTimezone")}</Label>
                    <Select value={clinicTimezone} onValueChange={setClinicTimezone}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-end mt-auto pt-2">
                <Button size="sm" disabled={isPending} onClick={() => onSave([
                  { key: "week_start_day", value: weekStartDay },
                  { key: "date_format", value: dateFormat },
                  { key: "time_format", value: timeFormat },
                  { key: "timezone", value: clinicTimezone },
                ])}>
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
