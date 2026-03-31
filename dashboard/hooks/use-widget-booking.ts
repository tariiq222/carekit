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
import { useMutation } from "@tanstack/react-query"
import { widgetCreateBooking } from "@/lib/api/widget"
import { useWidgetBookingQueries, useWidgetSlotsQuery } from "./use-widget-booking-queries"
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

  const queries = useWidgetBookingQueries(state, flowOrder)

  const { serviceTypes } = queries
  const activeServiceType = serviceTypes.find(
    (st) => st.bookingType === state.bookingType && st.isActive,
  )
  const durationOptions: PractitionerDurationOption[] =
    activeServiceType?.durationOptions ?? []

  const canFetchSlots =
    !!state.practitioner && !!state.date &&
    (!durationOptions.length || !!state.durationOption)

  const resolvedDuration = state.durationOption?.durationMinutes ?? undefined

  const { slots, slotsLoading } = useWidgetSlotsQuery(state, canFetchSlots, resolvedDuration)

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
    ...queries,
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
