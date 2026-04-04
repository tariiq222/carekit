"use client"

/**
 * Widget DateTime Step — Custom Calendar + Summary + Time Chips
 * Custom-built calendar grid (no shadcn Calendar) for pixel-perfect control
 */

import { useState, useMemo, useEffect } from "react"
import {
  format, startOfToday, isBefore, isAfter, addDays, startOfMonth,
  getDaysInMonth, getDay, addMonths, subMonths,
  isSameDay, isSameMonth,
} from "date-fns"
import { arSA, enUS } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Loading03Icon, Clock01Icon, Location04Icon,
  UserCircleIcon, Money01Icon, Time01Icon,
  Calendar01Icon, ArrowLeft01Icon, ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { TimeSlot } from "@/lib/types/practitioner"
import { useWidgetAvailableDatesQuery } from "@/hooks/use-widget-booking-queries"

interface AvailableTimeSlot extends TimeSlot { available: boolean }
interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
  maxAdvanceDays?: number
}

/* ─── Day names ─── */
const DAY_NAMES_AR = ["أحد", "اثن", "ثلا", "أرب", "خمس", "جمع", "سبت"]
const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/* ─── Custom Calendar ─── */
function CustomCalendar({
  month, onMonthChange, selectedDate, onDateSelect,
  isDateDisabled, isLoading, locale,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  selectedDate: Date | undefined
  onDateSelect: (d: Date) => void
  isDateDisabled: (d: Date) => boolean
  isLoading: boolean
  locale: "ar" | "en"
}) {
  const isRtl = locale === "ar"
  const dayNames = isRtl ? DAY_NAMES_AR : DAY_NAMES_EN
  const dateLocale = isRtl ? arSA : enUS

  /* build grid: blanks + days */
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const totalDays = getDaysInMonth(month)
  /* Sunday=0 … Saturday=6 — for RTL we keep same order (أحد→سبت) */
  const startOffset = getDay(firstDay) // 0-6

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  /* pad to complete last row */
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = format(month, "MMMM yyyy", { locale: dateLocale })

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header: prev / month / next */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="h-7 w-7 rounded-md flex items-center justify-center border border-border/60 hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={isRtl ? ArrowRight01Icon : ArrowLeft01Icon} size={14} className="text-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="h-7 w-7 rounded-md flex items-center justify-center border border-border/60 hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={isRtl ? ArrowLeft01Icon : ArrowRight01Icon} size={14} className="text-foreground" />
        </button>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-0">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Loading overlay */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />
        </div>
      ) : (
        /* Day cells */
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} />
            const disabled = isDateDisabled(date)
            const selected = selectedDate ? isSameDay(date, selectedDate) : false
            const isToday = isSameDay(date, startOfToday())
            const otherMonth = !isSameMonth(date, month)

            return (
              <div key={idx} className="flex items-center justify-center">
                <button
                  disabled={disabled}
                  onClick={() => onDateSelect(date)}
                  className={cn(
                    "w-8 h-8 rounded-full text-sm font-medium transition-all",
                    /* selected */
                    selected && "bg-primary text-primary-foreground font-semibold",
                    /* today — not selected */
                    !selected && isToday && "border border-primary/60 text-primary font-semibold",
                    /* normal available */
                    !selected && !isToday && !disabled && !otherMonth && "text-foreground hover:bg-primary/10 hover:text-primary",
                    /* other month days */
                    !selected && otherMonth && "text-muted-foreground/30",
                    /* disabled */
                    disabled && !selected && "text-muted-foreground/30 cursor-not-allowed line-through",
                  )}
                >
                  {format(date, "d")}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Main Step ─── */
export function WidgetDatetimeStep({ locale, booking, maxAdvanceDays = 0 }: Props) {
  const { slots, slotsLoading, durationOptions, state, setState, selectDateTime, goBack } = booking
  const isRtl = locale === "ar"
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(startOfToday()))
  const today = startOfToday()

  const monthStr = format(calendarMonth, "yyyy-MM")
  const resolvedDuration = state.durationOption?.durationMinutes ?? undefined
  const { availableDates, availableDatesLoading } = useWidgetAvailableDatesQuery(
    state.practitioner?.id, monthStr, resolvedDuration, state.branch?.id,
  )

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates])

  useEffect(() => {
    if (!availableDates.length || selectedDate) return
    const first = availableDates
      .map((d) => new Date(d))
      .filter((d) => !isBefore(d, today))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    if (first) setCalendarMonth(startOfMonth(first))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDates])

  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    setSelectedSlot(null)
    setState((s) => ({ ...s, date: format(date, "yyyy-MM-dd"), slot: null }))
  }

  function isDateDisabled(d: Date): boolean {
    if (isBefore(d, today)) return true
    // Enforce maxAdvanceDays limit (0 = no limit)
    if (maxAdvanceDays && maxAdvanceDays > 0) {
      const maxDate = addDays(today, maxAdvanceDays)
      if (isAfter(d, maxDate)) return true
    }
    if (!state.practitioner?.id || availableDatesLoading) return false
    return !availableDateSet.has(format(d, "yyyy-MM-dd"))
  }

  function handleNext() {
    if (!selectedDate || !selectedSlot) return
    selectDateTime(format(selectedDate, "yyyy-MM-dd"), selectedSlot)
  }

  const typedSlots = slots as AvailableTimeSlot[]
  const availableSlots = typedSlots.filter((s) => s.available)
  const unavailableSlots = typedSlots.filter((s) => !s.available)
  const allSlots = [...availableSlots, ...unavailableSlots]
  const durationMins = state.durationOption?.durationMinutes ?? 30
  const durationLabel = `${durationMins}د`

  const selectedDateLabel = selectedDate
    ? format(selectedDate, isRtl ? "EEEE، d MMMM" : "EEEE, d MMMM", { locale: isRtl ? arSA : enUS })
    : null

  return (
    <div className="flex flex-col gap-4 h-full">

{/* Duration selector */}
      {durationOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {durationOptions.map((opt) => (
            <button key={opt.id}
              onClick={() => setState((s) => ({ ...s, durationOption: opt, slot: null }))}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-all",
                state.durationOption?.id === opt.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 hover:border-primary/40",
              )}
            >
              {isRtl ? (opt.labelAr ?? opt.label) : opt.label} — {opt.price} {isRtl ? "ر.س" : "SAR"}
            </button>
          ))}
        </div>
      )}

      {/* ── Top: Calendar + Summary ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Custom Calendar */}
        <div className="flex-1 min-w-0 bg-surface border border-border/60 rounded-xl p-4">
          <CustomCalendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            isDateDisabled={isDateDisabled}
            isLoading={availableDatesLoading}
            locale={locale}
          />
        </div>

        {/* Summary card */}
        <div className="w-36 shrink-0 bg-surface-muted rounded-xl p-3 flex flex-col gap-2.5 border border-border/50">
          <p className="text-xs font-bold text-foreground border-b border-border pb-2">
            {isRtl ? "ملخص الحجز" : "Summary"}
          </p>
          {state.branch && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Location04Icon} size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight">
                {isRtl ? state.branch.nameAr : state.branch.nameEn}
              </span>
            </div>
          )}
          {state.service && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Calendar01Icon} size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight">
                {isRtl ? (state.service.nameAr ?? state.service.nameEn) : state.service.nameEn}
              </span>
            </div>
          )}
          {state.practitioner && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={UserCircleIcon} size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight">
                {isRtl ? (state.practitioner.nameAr ?? state.practitioner.specialty) : state.practitioner.specialty}
              </span>
            </div>
          )}
          {state.durationOption && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Time01Icon} size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight">
                {state.durationOption.durationMinutes} {isRtl ? "دقيقة" : "min"}
              </span>
            </div>
          )}
          {state.durationOption?.price != null && (
            <div className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Money01Icon} size={12} className="text-primary shrink-0 mt-0.5" />
              <span className="text-xs text-foreground leading-tight font-numeric">
                {state.durationOption.price} {isRtl ? "ر.س" : "SAR"}
              </span>
            </div>
          )}
          {(selectedDate || selectedSlot) && (
            <div className="mt-auto pt-2 border-t border-border flex flex-col gap-0.5">
              {selectedDate && (
                <p className="text-xs text-muted-foreground leading-tight">{selectedDateLabel}</p>
              )}
              {selectedSlot && (
                <p className="text-base font-bold text-primary font-numeric">{selectedSlot.startTime}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Time chips ── */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <HugeiconsIcon icon={Clock01Icon} size={13} className="text-primary" />
          {!selectedDate
            ? (isRtl ? "اختر يوماً أولاً" : "Pick a day first")
            : (isRtl ? "الأوقات المتاحة" : "Available Times")}
        </p>

        {!selectedDate ? null : slotsLoading ? (
          <div className="flex justify-center py-4">
            <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />
          </div>
        ) : availableSlots.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {isRtl ? "لا توجد أوقات في هذا اليوم" : "No slots available"}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {allSlots.map((slot, idx) => {
              const isSelected = selectedSlot?.startTime === slot.startTime
              return (
                <button key={idx} disabled={!slot.available} onClick={() => {
                  if (!slot.available) return
                  setSelectedSlot(slot)
                }}
                  className={cn(
                    "flex flex-col items-center py-2.5 px-2 rounded-lg border transition-all",
                    !slot.available && "opacity-40 cursor-not-allowed border-border/30 bg-surface-muted",
                    slot.available && isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : slot.available ? "border-border/60 hover:border-primary/50 hover:bg-primary/5" : "",
                  )}
                >
                  <span className={cn(
                    "text-sm font-bold font-numeric leading-tight",
                    !slot.available && "line-through",
                    isSelected ? "text-primary-foreground" : "text-foreground",
                  )}>{slot.startTime}</span>
                  <span dir="ltr" className={cn(
                    "text-xs font-numeric mt-0.5 leading-tight",
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}>{durationLabel}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer — RTL: back=right (first in DOM), next=left (second in DOM) */}
      <div className="flex items-center justify-between pt-4 mt-auto border-t border-border/50">
        <Button variant="outline" onClick={goBack} className="min-w-24">
          {isRtl ? "رجوع" : "Back"}
        </Button>
        <Button onClick={handleNext} disabled={!selectedDate || !selectedSlot} className="min-w-28">
          {isRtl ? "التالي" : "Next"}
        </Button>
      </div>
    </div>
  )
}
