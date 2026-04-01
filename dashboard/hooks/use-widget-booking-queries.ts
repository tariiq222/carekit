"use client"

/**
 * Widget Booking Queries — internal helper for use-widget-booking.ts
 * Separates data-fetching concerns from the state machine.
 */

import { useQuery } from "@tanstack/react-query"
import {
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  fetchPublicBranches,
  fetchWidgetAvailableDates,
} from "@/lib/api/widget"
import type { PublicBranch } from "@/lib/api/widget"
import { queryKeys } from "@/lib/query-keys"
import type { BookingFlowOrder, WizardState } from "./use-widget-booking"

const STALE_5M = 5 * 60 * 1000
const STALE_1M = 60 * 1000

export function useWidgetBookingQueries(state: WizardState, flowOrder: BookingFlowOrder) {
  const { data: practitionersData, isLoading: practitionersLoading } = useQuery({
    queryKey: queryKeys.practitioners.list({ isActive: true }),
    queryFn: () => fetchWidgetPractitioners({ perPage: 20 }),
    enabled: flowOrder === "practitioner_first",
    staleTime: STALE_5M,
  })

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.practitioners.services(state.practitioner?.id ?? ""),
    queryFn: () => fetchWidgetPractitionerServices(state.practitioner!.id),
    enabled: flowOrder === "practitioner_first" && !!state.practitioner,
    staleTime: STALE_5M,
  })

  const { data: servicesData, isLoading: allServicesLoading } = useQuery({
    queryKey: queryKeys.services.list({ isActive: true, widget: true }),
    queryFn: fetchWidgetServices,
    enabled: flowOrder === "service_first",
    staleTime: STALE_5M,
  })

  const { data: filteredPractitionersData, isLoading: filteredPractitionersLoading, isFetching: filteredPractitionersFetching } = useQuery({
    queryKey: queryKeys.practitioners.list({ isActive: true, serviceId: state.service?.id }),
    queryFn: () => fetchWidgetPractitioners({ perPage: 20, serviceId: state.service!.id }),
    enabled: flowOrder === "service_first" && !!state.service,
    staleTime: STALE_5M,
  })

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["widget", "branches"],
    queryFn: fetchPublicBranches,
    staleTime: STALE_5M,
  })

  const { data: serviceTypes = [] } = useQuery({
    queryKey: queryKeys.practitioners.serviceTypes(
      state.practitioner?.id ?? "",
      state.service?.id ?? "",
    ),
    queryFn: () => fetchWidgetServiceTypes(state.practitioner!.id, state.service!.id),
    enabled: !!state.practitioner && !!state.service,
    staleTime: STALE_5M,
  })

  return {
    practitionersData,
    practitionersLoading,
    services,
    servicesLoading,
    allServices: servicesData?.items ?? [],
    allServicesLoading,
    filteredPractitionersData,
    filteredPractitionersLoading: filteredPractitionersLoading || filteredPractitionersFetching,
    serviceTypes,
    branches,
    branchesLoading,
  }
}

export type { PublicBranch }

export function useWidgetSlotsQuery(
  state: WizardState,
  canFetchSlots: boolean,
  resolvedDuration: number | undefined,
) {
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [...queryKeys.practitioners.slots(state.practitioner?.id ?? "", state.date), resolvedDuration],
    queryFn: () => fetchWidgetSlots(state.practitioner!.id, state.date, resolvedDuration),
    enabled: canFetchSlots,
    staleTime: STALE_1M,
  })
  return { slots, slotsLoading }
}

export function useWidgetAvailableDatesQuery(
  practitionerId: string | undefined,
  month: string,
  duration: number | undefined,
  branchId?: string,
) {
  const { data: availableDates = [], isLoading: availableDatesLoading } = useQuery({
    queryKey: ["widget", "available-dates", practitionerId, month, duration, branchId],
    queryFn: () => fetchWidgetAvailableDates(practitionerId!, month, duration, branchId),
    enabled: !!practitionerId && !!month,
    staleTime: STALE_1M,
  })
  return { availableDates, availableDatesLoading }
}

