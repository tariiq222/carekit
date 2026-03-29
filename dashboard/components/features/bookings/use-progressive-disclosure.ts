import { useMemo } from "react"

export interface ProgressiveVisibility {
  showService: boolean
  showType: boolean
  showDuration: boolean
  showDatetime: boolean
  showTime: boolean
  showPayAtClinic: boolean
  canSubmit: boolean
}

interface ProgressiveDisclosureInput {
  practitionerId: string
  serviceId: string
  type: string
  durationOptionId: string
  date: string
  startTime: string
  hasDurationOptions: boolean
}

export function useProgressiveDisclosure({
  practitionerId,
  serviceId,
  type,
  durationOptionId,
  date,
  startTime,
  hasDurationOptions,
}: ProgressiveDisclosureInput): ProgressiveVisibility {
  return useMemo(() => {
    const showService = !!practitionerId
    const showType = showService && !!serviceId
    const showDuration = showType && !!type && hasDurationOptions
    const showDatetime = showType && !!type && (!hasDurationOptions || !!durationOptionId)
    const showTime = showDatetime && !!date
    const showPayAtClinic = showTime && !!startTime
    const canSubmit =
      !!practitionerId &&
      !!serviceId &&
      !!type &&
      (!hasDurationOptions || !!durationOptionId) &&
      !!date &&
      !!startTime

    return {
      showService,
      showType,
      showDuration,
      showDatetime,
      showTime,
      showPayAtClinic,
      canSubmit,
    }
  }, [practitionerId, serviceId, type, durationOptionId, date, startTime, hasDurationOptions])
}
