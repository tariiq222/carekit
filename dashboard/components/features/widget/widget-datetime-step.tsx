"use client"

/**
 * Widget DateTime Step — calendar (start) + time slots (end), side by side
 * Footer: Back + Next Step buttons
 * Disabled dates: days with no available slots for the selected practitioner
 */

import { useState, useMemo } from "react"
import { format, startOfToday, isBefore, startOfMonth } from "date-fns"
import { arSA, enUS } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { TimeSlot } from "@/lib/types/practitioner"
import { useWidgetAvailableDatesQuery } from "@/hooks/use-widget-booking-queries"

/* ─── Extended slot type ─── */
interface AvailableTimeSlot extends TimeSlot {
  available: boolean
}

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
}

export function WidgetDatetimeStep({ locale, booking }: Props) {
  const { slots, slotsLoading, durationOptions, state, setState, selectDateTime, goBack } = booking
  const isRtl = locale === "ar"
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(startOfToday()))
  const today = startOfToday()

  /* ─── Fetch available dates for current calendar month ─── */
  const monthStr = format(calendarMonth, "yyyy-MM")
  const resolvedDuration = state.durationOption?.durationMinutes ?? undefined
  const { availableDates, availableDatesLoading } = useWidgetAvailableDatesQuery(
    state.practitioner?.id,
    monthStr,
    resolvedDuration,
    state.branch?.id,
  )

  /* ─── Build a Set for O(1) lookup ─── */
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates])

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    setSelectedDate(date)
    setSelectedSlot(null)
    setState((s) => ({ ...s, date: format(date, "yyyy-MM-dd"), slot: null }))
  }

  function handleSlotSelect(slot: AvailableTimeSlot) {
    if (!slot.available) return
    setSelectedSlot(slot)
  }

  function handleNext() {
    if (!selectedDate || !selectedSlot) return
    selectDateTime(format(selectedDate, "yyyy-MM-dd"), selectedSlot)
  }

  /* ─── Disable logic: past days OR days with no available slots ─── */
  const hasPractitioner = !!state.practitioner?.id
  function isDateDisabled(d: Date): boolean {
    if (isBefore(d, today)) return true
    // No practitioner selected yet OR still loading → don't disable future dates
    if (!hasPractitioner || availableDatesLoading) return false
    const dateStr = format(d, "yyyy-MM-dd")
    return !availableDateSet.has(dateStr)
  }

  const typedSlots = slots as AvailableTimeSlot[]
  const availableSlots = typedSlots.filter((s) => s.available)
  const unavailableSlots = typedSlots.filter((s) => !s.available)

  /* ─── Step title ─── */
  const stepTitle = isRtl ? "اختر التاريخ والوقت" : "Select Date & Time"

  /* ─── Formatted selected date label ─── */
  const selectedDateLabel = selectedDate
    ? format(selectedDate, "dd-MM-yyyy")
    : null

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Step title */}
      <h2 className="text-lg font-semibold text-foreground mb-5">{stepTitle}</h2>

      {/* Duration selector (if applicable) */}
      {durationOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {durationOptions.map((opt) => (
            <button
              key={opt.id}
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

      {/* Two-column: calendar + time slots */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Calendar column — takes 60% */}
        <div className="flex-[3] min-w-0 relative">
          {/* Loading overlay on calendar while fetching available dates */}
          {availableDatesLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl z-10">
              <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />
            </div>
          )}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            locale={isRtl ? arSA : enUS}
            className="rounded-xl border border-border/60 w-full h-full [&_.rdp]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-tbody]:w-full [&_.rdp-row]:w-full"
            classNames={{
              day_selected: "bg-primary text-primary-foreground hover:bg-primary",
              day_today: "border border-primary/60 text-primary font-semibold",
              day_disabled: "opacity-30 cursor-not-allowed line-through",
              head_cell: "text-muted-foreground font-medium text-xs flex-1 text-center",
              head_row: "flex w-full",
              row: "flex w-full mt-1",
              cell: "flex-1 text-center",
              day: "w-full h-10 rounded-lg text-sm font-medium transition-colors hover:bg-muted",
              nav_button: "h-7 w-7 rounded-md border border-border/60 hover:bg-muted",
              caption: "text-sm font-semibold text-foreground",
              table: "w-full border-collapse",
            }}
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-border/50 self-stretch" />

        {/* Time slots column — takes 40% */}
        <div className="flex-[2] flex flex-col gap-3">
          {/* Date label */}
          <p className="text-sm font-medium text-primary font-numeric text-center">
            {selectedDateLabel ?? <span className="text-muted-foreground text-xs">{isRtl ? "اختر يوماً" : "Select a day"}</span>}
          </p>

          {/* Slots label */}
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            {isRtl ? "الوقت" : "Time"}
          </p>

          {/* Slot grid */}
          {!selectedDate ? (
            <p className="text-xs text-muted-foreground mt-2">
              {isRtl ? "اختر تاريخاً أولاً" : "Pick a date first"}
            </p>
          ) : slotsLoading ? (
            <div className="flex justify-center py-6">
              <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">
              {isRtl ? "لا توجد أوقات في هذا اليوم" : "No slots on this day"}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-64 pe-1">
              {[...availableSlots, ...unavailableSlots].map((slot, idx) => (
                <button
                  key={idx}
                  disabled={!slot.available}
                  onClick={() => handleSlotSelect(slot)}
                  className={cn(
                    "flex flex-col items-center py-2.5 px-1 rounded-lg text-xs font-medium border transition-all",
                    !slot.available && "opacity-40 cursor-not-allowed border-border/30 bg-surface-muted",
                    slot.available && selectedSlot?.startTime === slot.startTime
                      ? "border-primary bg-primary/10 text-primary"
                      : slot.available
                        ? "border-border/60 hover:border-primary/50 hover:bg-primary/5"
                        : "",
                  )}
                >
                  <span className="font-numeric">{slot.startTime}</span>
                  <span className="text-muted-foreground font-numeric">{slot.endTime}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Back + Next */}
      <div className="flex items-center justify-between pt-5 mt-auto border-t border-border/50">
        <Button
          variant="outline"
          onClick={goBack}
          className="min-w-20"
        >
          {isRtl ? "رجوع" : "BACK"}
        </Button>

        <Button
          onClick={handleNext}
          disabled={!selectedDate || !selectedSlot}
          className="min-w-28"
        >
          {isRtl ? "التالي" : "NEXT STEP"}
        </Button>
      </div>
    </div>
  )
}
