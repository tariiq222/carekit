import React from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchSlots, fetchPractitionerServiceTypes } from "@/lib/api/practitioners-schedule"
import { fetchPractitionerServices } from "@/lib/api/practitioners-schedule"
import { queryKeys } from "@/lib/query-keys"
import type { PractitionerDurationOption, PractitionerService } from "@/lib/types/practitioner"

interface UseBookingSlotsOptions {
  practitionerId: string
  serviceId: string
  bookingType: string
  date: string
  durationOptionId: string
}

export function useCreateBookingSlots({
  practitionerId,
  serviceId,
  bookingType,
  date,
  durationOptionId,
}: UseBookingSlotsOptions) {
  // Fetch services that belong to this practitioner
  const { data: practitionerServices = [], isLoading: practitionerServicesLoading } = useQuery<PractitionerService[]>({
    queryKey: queryKeys.practitioners.services(practitionerId),
    queryFn: () => fetchPractitionerServices(practitionerId),
    enabled: !!practitionerId,
  })

  const canFetchServiceTypes = !!practitionerId && !!serviceId

  const { data: serviceTypes = [], isLoading: serviceTypesLoading } = useQuery({
    queryKey: queryKeys.practitioners.serviceTypes(practitionerId, serviceId),
    queryFn: () => fetchPractitionerServiceTypes(practitionerId, serviceId),
    enabled: canFetchServiceTypes,
  })

  const durationOptions = React.useMemo((): PractitionerDurationOption[] => {
    if (!serviceTypes.length || !bookingType) return []
    const pst = serviceTypes.find((st) => st.bookingType === bookingType)
    if (!pst || !pst.isActive) return []
    return pst.durationOptions ?? []
  }, [serviceTypes, bookingType])

  const hasDurationOptions = durationOptions.length > 0

  const selectedDuration = React.useMemo((): number | undefined => {
    if (!hasDurationOptions) return undefined
    const opt = durationOptions.find((d) => d.id === durationOptionId)
    return opt?.durationMinutes
  }, [hasDurationOptions, durationOptions, durationOptionId])

  const canFetchSlots = !!practitionerId && !!date &&
    (!hasDurationOptions || !!selectedDuration)

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [...queryKeys.practitioners.slots(practitionerId, date), selectedDuration],
    queryFn: () => fetchSlots(practitionerId, date, selectedDuration),
    enabled: canFetchSlots,
  })

  return {
    practitionerServices,
    practitionerServicesLoading,
    durationOptions,
    hasDurationOptions,
    selectedDuration,
    canFetchSlots,
    serviceTypesLoading,
    canFetchServiceTypes,
    slots,
    slotsLoading,
  }
}
