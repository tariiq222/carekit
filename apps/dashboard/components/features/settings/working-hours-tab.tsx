"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ClinicHour } from "@/lib/api/clinic"
import { useClinicHours, useClinicHoursMutation } from "@/hooks/use-clinic-settings"
import { HolidaysSection } from "./holidays-section"
import { useClinicConfig } from "@/hooks/use-clinic-config"

/* ─── Constants ─── */

const DAYS_BASE = [
  { value: 0, en: "Sunday", ar: "الأحد" },
  { value: 1, en: "Monday", ar: "الاثنين" },
  { value: 2, en: "Tuesday", ar: "الثلاثاء" },
  { value: 3, en: "Wednesday", ar: "الأربعاء" },
  { value: 4, en: "Thursday", ar: "الخميس" },
  { value: 5, en: "Friday", ar: "الجمعة" },
  { value: 6, en: "Saturday", ar: "السبت" },
]

function getOrderedDays(weekStart: 0 | 1) {
  if (weekStart === 1) return [...DAYS_BASE.slice(1), DAYS_BASE[0]]
  return DAYS_BASE
}

function buildDefaultHours(days: typeof DAYS_BASE): ClinicHour[] {
  return days.map((d) => ({
    dayOfWeek: d.value,
    startTime: "09:00",
    endTime: "17:00",
    isActive: d.value >= 0 && d.value <= 4,
  }))
}

/* ─── Props ─── */

interface Props {
  t: (key: string) => string
}

type TabId = "hours" | "holidays"

/* ─── Working Hours Panel ─── */

function WorkingHoursPanel({ t }: Props) {
  const { weekStartDayNumber } = useClinicConfig()
  const orderedDays = useMemo(() => getOrderedDays(weekStartDayNumber), [weekStartDayNumber])
  const [hours, setHours] = useState<ClinicHour[]>(() => buildDefaultHours(orderedDays))

  const { data: serverHours, isLoading } = useClinicHours()
  const mutation = useClinicHoursMutation()

  useEffect(() => {
    const defaults = buildDefaultHours(orderedDays)
    if (!serverHours || serverHours.length === 0) {
      setHours(defaults)
      return
    }
    const merged = defaults.map((def) => {
      const match = serverHours.find((s: ClinicHour) => s.dayOfWeek === def.dayOfWeek)
      return match ?? { ...def, isActive: false }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHours(merged)
  }, [serverHours, orderedDays])

  const updateDay = (index: number, patch: Partial<ClinicHour>) => {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  }

  const handleSave = () => {
    const payload = hours.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
      dayOfWeek, startTime, endTime, isActive,
    }))
    mutation.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        {hours.map((hour, index) => (
          <Card key={hour.dayOfWeek} className="shadow-sm bg-surface">
            <CardContent className="pt-2 pb-2">
              <DayRow
                day={orderedDays[index]}
                hour={hour}
                onChange={(patch) => updateDay(index, patch)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button size="sm" disabled={mutation.isPending} onClick={handleSave}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Day Row ─── */

function DayRow({
  day,
  hour,
  onChange,
}: {
  day: { value: number; en: string; ar: string }
  hour: ClinicHour
  onChange: (patch: Partial<ClinicHour>) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border p-3 transition-colors",
        hour.isActive ? "border-border bg-surface" : "border-border bg-surface-muted"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Switch checked={hour.isActive} onCheckedChange={(v) => onChange({ isActive: v })} />
        <Label className="cursor-pointer select-none text-sm font-medium">
          <span className={hour.isActive ? "text-foreground" : "text-muted-foreground"}>{day.en}</span>
          <span className="ms-1 text-xs text-muted-foreground">({day.ar})</span>
        </Label>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input type="time" disabled={!hour.isActive} value={hour.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="time" disabled={!hour.isActive} value={hour.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40" />
      </div>
    </div>
  )
}

/* ─── Holidays Panel ─── */

function HolidaysPanel({ t }: Props) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <HolidaysSection t={t} />
    </div>
  )
}

/* ─── Main Component ─── */

export function WorkingHoursTab({ t }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("hours")

  const tabs: { id: TabId; label: string; desc: string }[] = [
    {
      id: "hours",
      label: t("settings.workingHours"),
      desc: t("settings.workingHoursDesc"),
    },
    {
      id: "holidays",
      label: t("settings.holidays"),
      desc: t("settings.holidaysDesc"),
    },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 border-e border-border bg-surface-muted flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Clock01Icon} size={14} className="text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("settings.tabs.hours")}
              </p>
            </div>
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
          {activeTab === "hours" && <WorkingHoursPanel t={t} />}
          {activeTab === "holidays" && <HolidaysPanel t={t} />}
        </div>
      </div>
    </Card>
  )
}
