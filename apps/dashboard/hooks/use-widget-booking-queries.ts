"use client"

/**
 * Widget Booking Queries — internal helper for use-widget-booking.ts
 * Separates data-fetching concerns from the state machine.
 */

import { useQuery } from "@tanstack/react-query"
import {
  fetchWidgetEmployees,
  fetchWidgetEmployeeServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  fetchPublicBranches,
  fetchWidgetAvailableDates,
} from "@/lib/api/widget"
import type { PublicBranch } from "@/lib/api/widget"
import { queryKeys } from "@/lib/query-keys"
import type { BookingFlowOrder } from "@/lib/api/clinic-settings"
import type { WizardState } from "./use-widget-booking"

const STALE_5M = 5 * 60 * 1000
const STALE_1M = 60 * 1000

export function useWidgetBookingQueries(state: WizardState, flowOrder: BookingFlowOrder) {
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true }),
    queryFn: () => fetchWidgetEmployees({ perPage: 20 }),
    enabled: flowOrder === "employee_first",
    staleTime: STALE_5M,
  })

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.employees.services(state.employee?.id ?? ""),
    queryFn: () => fetchWidgetEmployeeServices(state.employee!.id),
    enabled: flowOrder === "employee_first" && !!state.employee,
    staleTime: STALE_5M,
  })

  const { data: servicesData, isLoading: allServicesLoading } = useQuery({
    queryKey: queryKeys.services.list({ isActive: true, widget: true }),
    queryFn: fetchWidgetServices,
    enabled: flowOrder === "service_first",
    staleTime: STALE_5M,
  })

  const { data: filteredEmployeesData, isLoading: filteredEmployeesLoading, isFetching: filteredEmployeesFetching } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, serviceId: state.service?.id }),
    queryFn: () => fetchWidgetEmployees({ perPage: 20, serviceId: state.service!.id }),
    enabled: flowOrder === "service_first" && !!state.service,
    staleTime: STALE_5M,
  })

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["widget", "branches"],
    queryFn: fetchPublicBranches,
    staleTime: STALE_5M,
  })

  const { data: serviceTypes = [] } = useQuery({
    queryKey: queryKeys.employees.serviceTypes(
      state.employee?.id ?? "",
      state.service?.id ?? "",
    ),
    queryFn: () => fetchWidgetServiceTypes(state.employee!.id, state.service!.id),
    enabled: !!state.employee && !!state.service,
    staleTime: STALE_5M,
  })

  return {
    employeesData,
    employeesLoading,
    services,
    servicesLoading,
    allServices: servicesData?.items ?? [],
    allServicesLoading,
    filteredEmployeesData,
    filteredEmployeesLoading: filteredEmployeesLoading || filteredEmployeesFetching,
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
    queryKey: [...queryKeys.employees.slots(state.employee?.id ?? "", state.date), resolvedDuration],
    queryFn: () => fetchWidgetSlots(state.employee!.id, state.date, resolvedDuration),
    enabled: canFetchSlots,
    staleTime: STALE_1M,
  })
  return { slots, slotsLoading }
}

export function useWidgetAvailableDatesQuery(
  employeeId: string | undefined,
  month: string,
  duration: number | undefined,
  branchId?: string,
) {
  const { data: availableDates = [], isLoading: availableDatesLoading } = useQuery({
    queryKey: ["widget", "available-dates", employeeId, month, duration, branchId],
    queryFn: () => fetchWidgetAvailableDates(employeeId!, month, duration, branchId),
    enabled: !!employeeId && !!month,
    staleTime: STALE_1M,
  })
  return { availableDates, availableDatesLoading }
}

