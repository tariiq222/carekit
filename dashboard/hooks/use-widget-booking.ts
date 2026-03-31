/**
 * Widget Booking Hook — CareKit Embeddable Widget
 *
 * Manages the multi-step booking wizard state machine.
 * Steps: service → datetime → auth → confirm → success
 *
 * flowOrder controls which entity is selected first:
 * - "practitioner_first": pick practitioner → see their services (original)
 * - "service_first": pick service → see practitioners offering it
 */

"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  fetchWidgetPractitioners,
  fetchWidgetPractitionerServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  widgetCreateBooking,
} from "@/lib/api/widget"
import { queryKeys } from "@/lib/query-keys"
import type { Practitioner, PractitionerDurationOption, TimeSlot } from "@/lib/types/practitioner"
import type { Service } from "@/lib/types/service"
import type { BookingType, Booking } from "@/lib/types/booking"

/* ─── Types ─── */

export type WizardStep = "service" | "datetime" | "auth" | "confirm" | "success"
export type BookingFlowOrder = "service_first" | "practitioner_first"

export interface WizardState {
  step: WizardStep
  practitioner: Practitioner | null
  service: Service | null
  bookingType: BookingType | null
  durationOption: PractitionerDurationOption | null
  date: string
  slot: TimeSlot | null
  booking: Booking | null
}

/* ─── Hook ─── */

export function useWidgetBooking(
  initialPractitionerId?: string,
  initialServiceId?: string,
  flowOrder: BookingFlowOrder = "service_first",
) {
  const [state, setState] = useState<WizardState>({
    step: "service",
    practitioner: null,
    service: null,
    bookingType: null,
    durationOption: null,
    date: "",
    slot: null,
    booking: null,
  })

  /* ─── practitioner_first: fetch all practitioners upfront ─── */
  const { data: practitionersData, isLoading: practitionersLoading } = useQuery({
    queryKey: queryKeys.practitioners.list({ isActive: true }),
    queryFn: () => fetchWidgetPractitioners({ perPage: 20 }),
    enabled: flowOrder === "practitioner_first",
    staleTime: 5 * 60 * 1000,
  })

  /* ─── practitioner_first: fetch services for selected practitioner ─── */
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.practitioners.services(state.practitioner?.id ?? ""),
    queryFn: () => fetchWidgetPractitionerServices(state.practitioner!.id),
    enabled: flowOrder === "practitioner_first" && !!state.practitioner,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── service_first: fetch all services upfront ─── */
  const { data: servicesData, isLoading: allServicesLoading } = useQuery({
    queryKey: ["widget-services-all"],
    queryFn: fetchWidgetServices,
    enabled: flowOrder === "service_first",
    staleTime: 5 * 60 * 1000,
  })

  /* ─── service_first: fetch practitioners filtered by selected service ─── */
  const { data: filteredPractitionersData, isLoading: filteredPractitionersLoading } = useQuery({
    queryKey: queryKeys.practitioners.list({ isActive: true, serviceId: state.service?.id }),
    queryFn: () => fetchWidgetPractitioners({ perPage: 20, serviceId: state.service!.id }),
    enabled: flowOrder === "service_first" && !!state.service,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── Fetch service types (for booking type selection) ─── */
  const { data: serviceTypes = [] } = useQuery({
    queryKey: queryKeys.practitioners.serviceTypes(
      state.practitioner?.id ?? "",
      state.service?.id ?? "",
    ),
    queryFn: () =>
      fetchWidgetServiceTypes(state.practitioner!.id, state.service!.id),
    enabled: !!state.practitioner && !!state.service,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── Duration options for selected type ─── */
  const activeServiceType = serviceTypes.find(
    (st) => st.bookingType === state.bookingType && st.isActive,
  )
  const durationOptions: PractitionerDurationOption[] =
    activeServiceType?.durationOptions ?? []

  /* ─── Fetch slots ─── */
  const canFetchSlots =
    !!state.practitioner && !!state.date &&
    (!durationOptions.length || !!state.durationOption)

  const resolvedDuration = state.durationOption?.durationMinutes ?? undefined

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [...queryKeys.practitioners.slots(state.practitioner?.id ?? "", state.date), resolvedDuration],
    queryFn: () => fetchWidgetSlots(state.practitioner!.id, state.date, resolvedDuration),
    enabled: canFetchSlots,
  })

  /* ─── Create booking mutation ─── */
  const createMut = useMutation({
    mutationFn: widgetCreateBooking,
    onSuccess: (booking) => {
      setState((s) => ({ ...s, booking, step: "success" }))
    },
  })

  /* ─── Navigation helpers ─── */

  const selectPractitioner = useCallback((p: Practitioner) => {
    setState((s) => ({
      ...s,
      practitioner: p,
      service: flowOrder === "practitioner_first" ? null : s.service,
      bookingType: null,
      durationOption: null,
      slot: null,
    }))
  }, [flowOrder])

  const selectService = useCallback((svc: Service, type: BookingType) => {
    setState((s) => ({
      ...s,
      service: svc,
      bookingType: type,
      durationOption: null,
      slot: null,
      step: "datetime",
    }))
  }, [])

  const selectServiceOnly = useCallback((svc: Service) => {
    setState((s) => ({
      ...s,
      service: svc,
      practitioner: null,
      bookingType: null,
      durationOption: null,
      slot: null,
    }))
  }, [])

  const selectDateTime = useCallback((date: string, slot: TimeSlot) => {
    setState((s) => ({ ...s, date, slot, step: "auth" }))
  }, [])

  const onAuthComplete = useCallback(() => {
    setState((s) => ({ ...s, step: "confirm" }))
  }, [])

  const confirmBooking = useCallback(
    (notes?: string) => {
      if (!state.practitioner || !state.service || !state.bookingType || !state.date || !state.slot) return
      createMut.mutate({
        practitionerId: state.practitioner.id,
        serviceId: state.service.id,
        type: state.bookingType,
        date: state.date,
        startTime: state.slot.startTime,
        notes,
        ...(state.durationOption ? { durationOptionId: state.durationOption.id } : {}),
      })
    },
    [state, createMut],
  )

  const goBack = useCallback(() => {
    setState((s) => {
      const steps: WizardStep[] = ["service", "datetime", "auth", "confirm"]
      const idx = steps.indexOf(s.step)
      if (idx <= 0) return s
      return { ...s, step: steps[idx - 1] }
    })
  }, [])

  return {
    state,
    setState,
    flowOrder,
    // practitioner_first data
    practitionersData,
    practitionersLoading,
    services,
    servicesLoading,
    // service_first data
    allServices: servicesData?.items ?? [],
    allServicesLoading,
    filteredPractitionersData,
    filteredPractitionersLoading,
    // shared
    serviceTypes,
    durationOptions,
    slots,
    slotsLoading,
    canFetchSlots,
    selectPractitioner,
    selectService,
    selectServiceOnly,
    selectDateTime,
    onAuthComplete,
    confirmBooking,
    goBack,
    isConfirming: createMut.isPending,
    confirmError: createMut.error,
    initialPractitionerId,
    initialServiceId,
  }
}
