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

import { useState, useCallback, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { widgetCreateBooking } from "@/lib/api/widget"
import { useWidgetBookingQueries, useWidgetSlotsQuery } from "./use-widget-booking-queries"
import type { Practitioner, PractitionerDurationOption, TimeSlot } from "@/lib/types/practitioner"
import type { Service } from "@/lib/types/service"
import type { BookingType, Booking } from "@/lib/types/booking"
import type { PublicBranch } from "@/lib/api/widget"

/* ─── Types ─── */

export type WizardStep = "branch" | "service" | "datetime" | "auth" | "confirm" | "success"
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
  branch: PublicBranch | null
  couponCode: string | null
  couponId: string | null
  giftCardId: string | null
  discountAmount: number
  paymentMethod: "moyasar" | "at_clinic" | null
  showIntakePopup: boolean
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
    branch: null,
    couponCode: null,
    couponId: null,
    giftCardId: null,
    discountAmount: 0,
    paymentMethod: null,
    showIntakePopup: false,
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
      const showPopup = !!(booking.intakeFormId && !booking.intakeFormAlreadySubmitted)
      setState((s) => ({ ...s, booking, step: "success", showIntakePopup: showPopup }))
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
        ...(state.branch ? { branchId: state.branch.id } : {}),
        ...(state.couponCode ? { couponCode: state.couponCode } : {}),
        payAtClinic: state.paymentMethod === "at_clinic" ? true : undefined,
      })
    },
    [state, createMut],
  )

  const hasBranches = (queries.branches?.length ?? 0) > 1

  useEffect(() => {
    if (hasBranches) {
      setState((s) => s.step === "service" && !s.branch ? { ...s, step: "branch" } : s)
    }
  }, [hasBranches])

  const goBack = useCallback(() => {
    setState((s) => {
      const steps: WizardStep[] = hasBranches
        ? ["branch", "service", "datetime", "auth", "confirm"]
        : ["service", "datetime", "auth", "confirm"]
      const idx = steps.indexOf(s.step)
      if (idx <= 0) return s
      return { ...s, step: steps[idx - 1] }
    })
  }, [hasBranches])

  // Sub-step back helpers (used inside "service" step)
  const clearPractitioner = useCallback(() => {
    setState((s) => ({ ...s, practitioner: null, bookingType: null, durationOption: null, slot: null }))
  }, [])

  // Clears service + practitioner (go back to first sub-step)
  const clearService = useCallback(() => {
    setState((s) => ({ ...s, service: null, practitioner: null, bookingType: null, durationOption: null, slot: null }))
  }, [])

  // Clears service only — keeps practitioner (practitioner_first: go back from booking-type to service list)
  const clearServiceOnly = useCallback(() => {
    setState((s) => ({ ...s, service: null, bookingType: null, durationOption: null, slot: null }))
  }, [])

  const selectBranch = useCallback((branch: PublicBranch) => {
    setState((s) => ({ ...s, branch, step: "service" }))
  }, [])

  const applyDiscount = useCallback((
    code: string,
    discountAmount: number,
    couponId?: string,
    giftCardId?: string,
  ) => {
    setState((s) => ({
      ...s,
      couponCode: code,
      discountAmount,
      couponId: couponId ?? null,
      giftCardId: giftCardId ?? null,
    }))
  }, [])

  const clearDiscount = useCallback(() => {
    setState((s) => ({
      ...s,
      couponCode: null,
      discountAmount: 0,
      couponId: null,
      giftCardId: null,
    }))
  }, [])

  const selectPaymentMethod = useCallback((method: "moyasar" | "at_clinic") => {
    setState((s) => ({ ...s, paymentMethod: method }))
  }, [])

  const dismissIntakePopup = useCallback(() => {
    setState((s) => ({ ...s, showIntakePopup: false }))
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
    clearPractitioner,
    clearService,
    clearServiceOnly,
    hasBranches,
    branches: queries.branches,
    branchesLoading: queries.branchesLoading,
    selectBranch,
    applyDiscount,
    clearDiscount,
    selectPaymentMethod,
    dismissIntakePopup,
  }
}
