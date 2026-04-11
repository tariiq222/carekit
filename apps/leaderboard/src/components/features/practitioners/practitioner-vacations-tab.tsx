import { useState } from 'react'
import type { CreateVacationPayload } from '@carekit/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HIcon } from '@/components/shared/hicon'
import {
  usePractitionerVacations,
  useCreatePractitionerVacation,
  useDeletePractitionerVacation,
} from '@/hooks/use-practitioners'

interface Props {
  practitionerId: string
}

const FORMAT = { year: 'numeric', month: 'short', day: 'numeric' } as const

export function PractitionerVacationsTab({ practitionerId }: Props) {
  const { data: vacations = [], isLoading } = usePractitionerVacations(practitionerId)
  const createVacation = useCreatePractitionerVacation(practitionerId)
  const deleteVacation = useDeletePractitionerVacation(practitionerId)

  const [form, setForm] = useState<CreateVacationPayload>({
    startDate: '',
    endDate: '',
    reason: '',
  })

  const handleAdd = async () => {
    if (!form.startDate || !form.endDate) return
    await createVacation.mutateAsync({
      startDate: form.startDate,
      endDate: form.endDate,
      ...(form.reason?.trim() ? { reason: form.reason.trim() } : {}),
    })
    setForm({ startDate: '', endDate: '', reason: '' })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 rounded-[var(--radius)] bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Add vacation */}
      <div className="glass rounded-[var(--radius)] p-4 space-y-3">
        <p className="text-sm font-medium">إضافة إجازة</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">من</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">إلى</Label>
            <Input
              type="date"
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">السبب (اختياري)</Label>
          <Input
            placeholder="إجازة سنوية..."
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={!form.startDate || !form.endDate || createVacation.isPending}
          size="sm"
        >
          <HIcon name="hgi-add-01" className="me-1" />
          إضافة
        </Button>
        {createVacation.isError && (
          <p className="text-xs text-[var(--error,#dc2626)]">تعذرت الإضافة</p>
        )}
      </div>

      {/* Vacations list */}
      {vacations.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
          لا توجد إجازات مسجّلة
        </p>
      ) : (
        <div className="space-y-2">
          {vacations.map((v) => (
            <div
              key={v.id}
              className="glass rounded-[var(--radius)] p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {new Date(v.startDate).toLocaleDateString('ar-SA', FORMAT)}
                  {' — '}
                  {new Date(v.endDate).toLocaleDateString('ar-SA', FORMAT)}
                </p>
                {v.reason && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{v.reason}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('حذف هذه الإجازة؟')) deleteVacation.mutate(v.id)
                }}
                className="size-8 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--error,#dc2626)] hover:bg-[color:var(--error,#dc2626)]/10 transition-colors"
              >
                <HIcon name="hgi-delete-02" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
