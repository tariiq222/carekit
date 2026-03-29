"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { useLocale } from "@/components/locale-provider"
import type { AvailabilitySlot } from "@/lib/types/practitioner"
import { DAY_NAMES_EN, DAY_NAMES_AR } from "./schedule-types"
import type { LocalBreak, LocalVacation } from "./schedule-types"
import { nextBreakKey } from "./schedule-types"
import { VacationCard } from "./vacation-card"
import { DayScheduleCard } from "./day-schedule-card"

export type { LocalBreak, LocalVacation }

/* ─── Props ─── */

interface ScheduleTabProps {
  schedule: AvailabilitySlot[]
  onScheduleChange: (schedule: AvailabilitySlot[]) => void
  breaks: LocalBreak[]
  onBreaksChange: (breaks: LocalBreak[]) => void
  vacation: LocalVacation
  onVacationChange: (vacation: LocalVacation) => void
}

/* ─── Component ─── */

export function ScheduleTab({
  schedule,
  onScheduleChange,
  breaks,
  onBreaksChange,
  vacation,
  onVacationChange,
}: ScheduleTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const dayNames = isAr ? DAY_NAMES_AR : DAY_NAMES_EN

  /* Schedule handlers */
  const updateSlot = (
    index: number,
    field: keyof AvailabilitySlot,
    value: string | boolean,
  ) => {
    const updated = [...schedule]
    updated[index] = { ...updated[index], [field]: value }
    onScheduleChange(updated)
  }

  /* Break handlers */
  const addBreak = (dayOfWeek: number) => {
    onBreaksChange([
      ...breaks,
      { key: nextBreakKey(), dayOfWeek, startTime: "12:00", endTime: "13:00" },
    ])
  }

  const removeBreak = (key: string) => {
    onBreaksChange(breaks.filter((b) => b.key !== key))
  }

  const updateBreak = (
    key: string,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    onBreaksChange(
      breaks.map((b) => (b.key === key ? { ...b, [field]: value } : b)),
    )
  }

  /* Group breaks by day */
  const breaksByDay = Array.from({ length: 7 }, (_, i) =>
    breaks.filter((b) => b.dayOfWeek === i),
  )

  return (
    <div className="space-y-4">
      <VacationCard
        vacation={vacation}
        onVacationChange={onVacationChange}
      />

      {/* Weekly Schedule Card */}
      <Card
        className={vacation.enabled ? "opacity-40 pointer-events-none" : ""}
        aria-disabled={vacation.enabled || undefined}
        {...(vacation.enabled ? { inert: "" } : {})}
      >
        <CardHeader>
          <CardTitle>{t("practitioners.create.scheduleSection")}</CardTitle>
          <CardDescription>
            {vacation.enabled
              ? t("schedule.suspended")
              : t("schedule.setHours")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {schedule.map((slot, index) => (
              <DayScheduleCard
                key={slot.dayOfWeek}
                slot={slot}
                dayName={dayNames[index]}
                dayBreaks={breaksByDay[index]}
                addBreakLabel={t("practitioners.create.addBreak")}
                onSlotChange={(field, value) => updateSlot(index, field, value)}
                onAddBreak={() => addBreak(index)}
                onRemoveBreak={removeBreak}
                onUpdateBreak={updateBreak}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
