"use client"

/**
 * Widget DateTime Step — Select date and time slot
 */

import { useState } from "react"
import { format, addDays, startOfToday, isBefore } from "date-fns"
import { arSA, enUS } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { TimeSlot } from "@/lib/types/practitioner"

/* ─── Extended slot type with availability ─── */
interface AvailableTimeSlot extends TimeSlot {
  available: boolean
}

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
}

export function WidgetDatetimeStep({ locale, booking }: Props) {
  const { slots, slotsLoading, durationOptions, state, setState, selectDateTime } = booking
  const isRtl = locale === "ar"
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const today = startOfToday()

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

  function handleConfirm() {
    if (!selectedDate || !selectedSlot) return
    selectDateTime(format(selectedDate, "yyyy-MM-dd"), selectedSlot)
  }

  const typedSlots = slots as AvailableTimeSlot[]
  const availableSlots = typedSlots.filter((s) => s.available)
  const unavailableSlots = typedSlots.filter((s) => !s.available)

  return (
    <div className="space-y-4">
      {/* Duration option selector */}
      {durationOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {isRtl ? "مدة الجلسة" : "Session Duration"}
          </p>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setState((s) => ({ ...s, durationOption: opt, slot: null }))}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border transition-all",
                  state.durationOption?.id === opt.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 hover:border-primary/40",
                )}
              >
                {isRtl ? (opt.labelAr ?? opt.label) : opt.label} — {opt.price} {isRtl ? "ر.س" : "SAR"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(d) => isBefore(d, today) || isBefore(addDays(today, -1), d) === false && isBefore(d, today)}
          locale={isRtl ? arSA : enUS}
          className="rounded-xl border border-border/50 p-2"
          classNames={{
            day_selected: "bg-primary text-primary-foreground",
            day_today: "border border-primary text-primary font-semibold",
          }}
        />
      </div>

      {/* Slots */}
      {selectedDate && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {isRtl ? "الأوقات المتاحة" : "Available Times"}
          </p>

          {slotsLoading ? (
            <div className="flex justify-center py-4">
              <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary" />
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isRtl ? "لا توجد أوقات متاحة في هذا اليوم" : "No available slots on this day"}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {[...availableSlots, ...unavailableSlots].map((slot, idx: number) => (
                <button
                  key={idx}
                  disabled={!slot.available}
                  onClick={() => handleSlotSelect(slot)}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-medium transition-all border",
                    !slot.available && "opacity-40 cursor-not-allowed border-border/30 bg-muted",
                    slot.available && selectedSlot?.startTime === slot.startTime
                      ? "border-primary bg-primary text-primary-foreground"
                      : slot.available
                        ? "border-border/60 hover:border-primary/60 hover:bg-primary/5"
                        : "",
                  )}
                >
                  {slot.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSlot && (
        <div className="flex items-center justify-between pt-1">
          <Badge variant="secondary" className="text-xs">
            {selectedSlot.startTime} — {selectedSlot.endTime}
          </Badge>
          <Button onClick={handleConfirm} size="sm">
            {isRtl ? "التالي" : "Next"}
          </Button>
        </div>
      )}
    </div>
  )
}
