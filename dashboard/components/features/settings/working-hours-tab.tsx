"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { ClinicHour } from "@/lib/api/clinic"
import {
  useClinicHours,
  useClinicHoursMutation,
  useBookingSettings,
  useBookingSettingsMutation,
} from "@/hooks/use-clinic-settings"
import { HolidaysSection } from "./holidays-section"

/* ─── Constants ─── */

const DAYS = [
  { value: 0, en: "Sunday", ar: "الأحد" },
  { value: 1, en: "Monday", ar: "الاثنين" },
  { value: 2, en: "Tuesday", ar: "الثلاثاء" },
  { value: 3, en: "Wednesday", ar: "الأربعاء" },
  { value: 4, en: "Thursday", ar: "الخميس" },
  { value: 5, en: "Friday", ar: "الجمعة" },
  { value: 6, en: "Saturday", ar: "السبت" },
]

const DEFAULT_HOURS: ClinicHour[] = DAYS.map((d) => ({
  dayOfWeek: d.value,
  startTime: "09:00",
  endTime: "17:00",
  isActive: d.value >= 0 && d.value <= 4,
}))

/* ─── Props ─── */

interface Props {
  t: (key: string) => string
}

/* ─── Component ─── */

export function WorkingHoursTab({ t }: Props) {
  return (
    <div className="space-y-6">
      <WorkingHoursCard t={t} />
      <AdminOverrideCard t={t} />
      <HolidaysSection t={t} />
    </div>
  )
}

/* ─── Working Hours Card ─── */

function WorkingHoursCard({ t }: Props) {
  const [hours, setHours] = useState<ClinicHour[]>(DEFAULT_HOURS)

  const { data: serverHours, isLoading } = useClinicHours()
  const mutation = useClinicHoursMutation()

  useEffect(() => {
    if (!serverHours || serverHours.length === 0) return
    const merged = DEFAULT_HOURS.map((def) => {
      const match = serverHours.find(
        (s: ClinicHour) => s.dayOfWeek === def.dayOfWeek,
      )
      return match ?? { ...def, isActive: false }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHours(merged)
  }, [serverHours])

  const updateDay = (index: number, patch: Partial<ClinicHour>) => {
    setHours((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    )
  }

  const handleSave = () => {
    const payload = hours.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
      dayOfWeek,
      startTime,
      endTime,
      isActive,
    }))
    mutation.mutate(payload, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} size={18} className="text-primary" />
          <div>
            <CardTitle className="text-sm">{t("settings.workingHours")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings.workingHoursDesc")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours.map((hour, index) => (
          <DayRow
            key={hour.dayOfWeek}
            day={DAYS[index]}
            hour={hour}
            onChange={(patch) => updateDay(index, patch)}
          />
        ))}

        <Separator />

        <div className="flex justify-end">
          <Button size="sm" disabled={mutation.isPending} onClick={handleSave}>
            {t("settings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
      className={`flex items-center justify-between gap-4 rounded-md border p-3 transition-colors ${
        hour.isActive ? "border-border bg-surface" : "border-border bg-surface-muted"
      }`}
    >
      {/* Day name + toggle */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Switch
          checked={hour.isActive}
          onCheckedChange={(v) => onChange({ isActive: v })}
        />
        <Label className="cursor-pointer select-none text-sm font-medium">
          <span className={hour.isActive ? "text-foreground" : "text-muted-foreground"}>
            {day.en}
          </span>
          <span className="ms-1 text-xs text-muted-foreground">({day.ar})</span>
        </Label>
      </div>

      {/* Time range */}
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="time"
          disabled={!hour.isActive}
          value={hour.startTime}
          onChange={(e) => onChange({ startTime: e.target.value })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="time"
          disabled={!hour.isActive}
          value={hour.endTime}
          onChange={(e) => onChange({ endTime: e.target.value })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40"
        />
      </div>
    </div>
  )
}

/* ─── Admin Override Card ─── */

function AdminOverrideCard({ t }: Props) {
  const [enabled, setEnabled] = useState(false)

  const { data: settings, isLoading } = useBookingSettings()
  const mutation = useBookingSettingsMutation()

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(settings.adminCanBookOutsideHours === true)
    }
  }, [settings])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  const handleToggle = (value: boolean) => {
    setEnabled(value)
    mutation.mutate(
      { adminCanBookOutsideHours: value },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (err: Error) => toast.error(err.message),
      },
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("settings.adminOutsideHours")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.adminOutsideHoursDesc")}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={mutation.isPending}
          />
        </div>
      </CardContent>
    </Card>
  )
}
