import { useState } from 'react'
import type { BreakSlotInput } from '@carekit/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HIcon } from '@/components/shared/hicon'
import {
  usePractitionerBreaks,
  useSetPractitionerBreaks,
} from '@/hooks/use-practitioners'

interface Props {
  practitionerId: string
}

const DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

interface LocalBreak {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export function PractitionerBreaksTab({ practitionerId }: Props) {
  const { data: savedBreaks = [], isLoading } = usePractitionerBreaks(practitionerId)
  const setBreaks = useSetPractitionerBreaks(practitionerId)

  const [breaks, setBreaksLocal] = useState<LocalBreak[] | null>(null)

  // Initialize from server on first render
  const working: LocalBreak[] = breaks ?? savedBreaks.map((b) => ({
    dayOfWeek: b.dayOfWeek,
    startTime: b.startTime,
    endTime: b.endTime,
  }))

  const addBreak = (dayOfWeek: number) => {
    setBreaksLocal([...working, { dayOfWeek, startTime: '13:00', endTime: '14:00' }])
  }

  const removeBreak = (idx: number) => {
    setBreaksLocal(working.filter((_, i) => i !== idx))
  }

  const updateBreak = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    setBreaksLocal(
      working.map((b, i) => (i === idx ? { ...b, [field]: value } : b)),
    )
  }

  const handleSave = async () => {
    const payload: BreakSlotInput[] = working.map((b) => ({
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
    }))
    await setBreaks.mutateAsync({ breaks: payload })
    setBreaksLocal(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--radius)] bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
    )
  }

  const byDay = DAY_LABELS.map((label, dayOfWeek) => ({
    label,
    dayOfWeek,
    items: working
      .map((b, idx) => ({ ...b, idx }))
      .filter((b) => b.dayOfWeek === dayOfWeek),
  }))

  const isDirty = breaks !== null

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-3">
        {byDay.map(({ label, dayOfWeek, items }) => (
          <div key={dayOfWeek} className="glass rounded-[var(--radius)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <button
                type="button"
                onClick={() => addBreak(dayOfWeek)}
                className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
              >
                <HIcon name="hgi-add-01" size={14} />
                إضافة استراحة
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">لا توجد استراحات</p>
            ) : (
              <div className="space-y-2">
                {items.map(({ idx, startTime, endTime }) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => updateBreak(idx, 'startTime', e.target.value)}
                      className="w-32 text-sm"
                    />
                    <span className="text-[var(--muted-foreground)] text-xs">—</span>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => updateBreak(idx, 'endTime', e.target.value)}
                      className="w-32 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeBreak(idx)}
                      className="size-7 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--error,#dc2626)] hover:bg-[color:var(--error,#dc2626)]/10 transition-colors"
                    >
                      <HIcon name="hgi-delete-02" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!isDirty || setBreaks.isPending}>
          <HIcon name="hgi-tick-02" className="me-1" />
          حفظ الاستراحات
        </Button>
        {isDirty && (
          <button
            type="button"
            onClick={() => setBreaksLocal(null)}
            className="text-xs text-[var(--muted-foreground)] hover:underline"
          >
            إلغاء
          </button>
        )}
        {setBreaks.isError && (
          <span className="text-xs text-[var(--error,#dc2626)]">تعذر الحفظ</span>
        )}
        {setBreaks.isSuccess && !isDirty && (
          <span className="text-xs text-[var(--success,#16a34a)]">تم الحفظ</span>
        )}
      </div>
    </div>
  )
}
