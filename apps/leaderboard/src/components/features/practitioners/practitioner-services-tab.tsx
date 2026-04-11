import { useState } from 'react'
import type { AssignPractitionerServicePayload } from '@carekit/api-client'
import { Button } from '@/components/ui/button'
import { HIcon } from '@/components/shared/hicon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  usePractitionerServices,
  useAssignPractitionerService,
  useUpdatePractitionerService,
  useRemovePractitionerService,
} from '@/hooks/use-practitioners'
import { useServices } from '@/hooks/use-services'

interface Props {
  practitionerId: string
}

export function PractitionerServicesTab({ practitionerId }: Props) {
  const { data: practitionerServices = [], isLoading } = usePractitionerServices(practitionerId)
  const { data: allServicesRes } = useServices({ perPage: 200 })
  const assignService = useAssignPractitionerService(practitionerId)
  const updateService = useUpdatePractitionerService(practitionerId)
  const removeService = useRemovePractitionerService(practitionerId)

  const [selectedServiceId, setSelectedServiceId] = useState('')

  const assignedIds = new Set(practitionerServices.map((ps) => ps.serviceId))
  const availableServices = (allServicesRes?.items ?? []).filter(
    (s) => !assignedIds.has(s.id),
  )

  const handleAssign = async () => {
    if (!selectedServiceId) return
    const payload: AssignPractitionerServicePayload = {
      serviceId: selectedServiceId,
      availableTypes: ['in_person'],
      isActive: true,
    }
    await assignService.mutateAsync(payload)
    setSelectedServiceId('')
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-[var(--radius)] bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Add service */}
      <div className="glass rounded-[var(--radius)] p-4">
        <p className="text-sm font-medium mb-3">إضافة خدمة</p>
        <div className="flex gap-2">
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="اختر خدمة..." />
            </SelectTrigger>
            <SelectContent>
              {availableServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAssign}
            disabled={!selectedServiceId || assignService.isPending}
          >
            <HIcon name="hgi-add-01" className="me-1" />
            إضافة
          </Button>
        </div>
      </div>

      {/* Services list */}
      {practitionerServices.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
          لم تُضف أي خدمة بعد
        </p>
      ) : (
        <div className="space-y-2">
          {practitionerServices.map((ps) => (
            <div
              key={ps.id}
              className="glass rounded-[var(--radius)] p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{ps.service.nameAr}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {ps.customDuration ?? ps.service.duration} دقيقة
                  {ps.bufferMinutes > 0 && ` · احتياطي ${ps.bufferMinutes} د`}
                  {' · '}
                  {ps.availableTypes.includes('in_person') && 'حضوري'}
                  {ps.availableTypes.includes('in_person') && ps.availableTypes.includes('online') && ' / '}
                  {ps.availableTypes.includes('online') && 'أونلاين'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`active-${ps.id}`}
                    checked={ps.isActive}
                    onCheckedChange={(checked) =>
                      updateService.mutate({ serviceId: ps.serviceId, payload: { isActive: checked } })
                    }
                  />
                  <Label htmlFor={`active-${ps.id}`} className="text-xs cursor-pointer">
                    {ps.isActive ? 'مفعّل' : 'موقوف'}
                  </Label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`حذف خدمة "${ps.service.nameAr}"؟`))
                      removeService.mutate(ps.serviceId)
                  }}
                  className="size-8 flex items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:text-[var(--error,#dc2626)] hover:bg-[color:var(--error,#dc2626)]/10 transition-colors"
                >
                  <HIcon name="hgi-delete-02" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
