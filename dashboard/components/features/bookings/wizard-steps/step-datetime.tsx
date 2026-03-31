'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { fetchSlots } from '@/lib/api/practitioners-schedule'
import { queryKeys } from '@/lib/query-keys'
import { WizardCard } from '../wizard-card'
import { cn } from '@/lib/utils'
import type { TimeSlot } from '@/lib/types/practitioner'

interface StepDatetimeProps {
  practitionerId: string
  durationOptionId: string | null
  selectedDate: string | null
  selectedTime: string | null
  onSelectDate: (date: string) => void
  onSelectTime: (time: string) => void
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function build14Days(): Date[] {
  const days: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

export function StepDatetime({
  practitionerId,
  durationOptionId,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: StepDatetimeProps) {
  const t = useTranslations()

  const days = useMemo(() => build14Days(), [])

  // We need the resolved duration minutes to pass to fetchSlots.
  // The parent already resolved it via useCreateBookingSlots; here we only
  // need to re-fetch slots given the final durationOptionId is resolved to
  // a duration number. Since step-datetime receives durationOptionId (not
  // durationMinutes), we skip duration — the parent controls enabled state.
  // If the slot query needs duration, the parent should pass durationMinutes instead.
  // For now: fetch without duration (matches pattern where duration may be optional).

  const canFetch = !!practitionerId && !!selectedDate

  const { data: slots = [], isLoading } = useQuery<TimeSlot[]>({
    queryKey: [...queryKeys.practitioners.slots(practitionerId, selectedDate ?? ''), durationOptionId],
    queryFn: () => fetchSlots(practitionerId, selectedDate!, undefined),
    enabled: canFetch,
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Day strip */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          {t('bookings.wizard.step.datetime.dayTitle')}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {days.map((day) => {
            const iso = toISODate(day)
            const isSelected = iso === selectedDate
            const weekday = day.toLocaleDateString('ar-SA', { weekday: 'short' })
            const dayMonth = day.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelectDate(iso)}
                className={cn(
                  'flex min-w-[64px] flex-col items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2',
                  'text-center transition-all duration-150',
                  'hover:border-primary/40 hover:bg-primary/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isSelected && 'border-primary bg-primary/8 ring-1 ring-primary/30',
                )}
              >
                <span className="text-xs text-muted-foreground">{weekday}</span>
                <span className={cn('text-sm font-semibold', isSelected && 'text-primary')}>
                  {dayMonth}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            {t('bookings.wizard.step.datetime.timeTitle')}
          </p>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {t('bookings.wizard.step.datetime.noSlots')}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <WizardCard
                  key={slot.startTime}
                  onClick={() => onSelectTime(slot.startTime)}
                  selected={slot.startTime === selectedTime}
                  className="flex items-center justify-center py-2 text-sm font-medium"
                >
                  {slot.startTime}
                </WizardCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
