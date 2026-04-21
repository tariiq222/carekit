"use client"

/**
 * Employee Profile — Secondary sections
 * (Availability, Vacations, Services card wrapper)
 */

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Clock01Icon,
  Building04Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@carekit/ui"
import { Skeleton } from "@carekit/ui"
import {
  useEmployeeAvailability,
  useEmployeeVacations,
} from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { EmployeeServicesSection } from "./employee-services-section"

/* ─── Re-export Ratings so page imports from one place ─── */
export { EmployeeRatingsSection } from "./employee-ratings-section"

/* ─── Constants ─── */

const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/* ─── Availability Section ─── */

interface WithId { employeeId: string }

export function EmployeeAvailabilitySection({ employeeId }: WithId) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const { data: schedule, isLoading } = useEmployeeAvailability(employeeId)

  const activeSlots = schedule?.filter((s) => s.isActive) ?? []
  const dayNames = isAr ? DAY_NAMES_AR : DAY_NAMES_EN

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <HugeiconsIcon icon={Clock01Icon} size={16} className="text-primary" />
          </div>
          {isAr ? "أوقات العمل" : "Working Hours"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
        ) : activeSlots.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {isAr ? "لم يتم تحديد أوقات العمل بعد" : "No working hours set yet"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activeSlots.map((slot) => (
              <div
                key={slot.dayOfWeek}
                className="flex flex-col gap-1 rounded-md border border-border bg-surface-muted/40 p-2.5"
              >
                <span className="text-xs font-semibold text-foreground">
                  {dayNames[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {slot.startTime} – {slot.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Vacations Section ─── */

export function EmployeeVacationsSection({ employeeId }: WithId) {
  const { locale } = useLocale()
  const isAr = locale === "ar"
  const { data: vacations, isLoading } = useEmployeeVacations(employeeId)

  const upcoming = (vacations ?? []).filter((v) => new Date(v.endDate) >= new Date())

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-warning/10">
            <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-warning" />
          </div>
          {isAr ? "الإجازات القادمة" : "Upcoming Vacations"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex items-center gap-2 py-4">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-success" />
            <p className="text-sm text-muted-foreground">
              {isAr ? "لا إجازات مجدولة" : "No upcoming vacations"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md border border-border bg-warning/5 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium tabular-nums text-foreground">
                    {new Date(v.startDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                    {" – "}
                    {new Date(v.endDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                  </span>
                  {v.reason && (
                    <span className="text-xs text-muted-foreground">{v.reason}</span>
                  )}
                </div>
                <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-warning" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Services Card Wrapper ─── */

export function EmployeeServicesSectionCard({ employeeId }: WithId) {
  const { locale } = useLocale()
  const isAr = locale === "ar"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent/10">
            <HugeiconsIcon icon={Building04Icon} size={16} className="text-accent" />
          </div>
          {isAr ? "الخدمات المتاحة" : "Available Services"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EmployeeServicesSection employeeId={employeeId} />
      </CardContent>
    </Card>
  )
}
