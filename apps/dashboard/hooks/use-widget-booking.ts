/**
 * Widget Booking Hook — CareKit Embeddable Widget
 *
 * Manages the multi-step booking wizard state machine.
 * Steps: service → datetime → auth → confirm → success
 *
 * flowOrder controls which entity is selected first:
 * - "employee_first": pick employee → see their services (original)
 * - "service_first": pick service → see employees offering it
 */

"use client"

import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { widgetCreateBooking } from "@/lib/api/widget"
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
import { useWidgetBookingQueries, useWidgetSlotsQuery } from "./use-widget-booking-queries"
import type { Employee, EmployeeDurationOption, TimeSlot } from "@/lib/types/employee"
import type { Service } from "@/lib/types/service"
import type { BookingType, Booking } from "@/lib/types/booking"
import type { PublicBranch } from "@/lib/api/widget"

/* ─── Types ─── */

export type WizardStep = "branch" | "service" | "datetime" | "auth" | "confirm" | "success"

export interface WizardState {
  step: WizardStep
  employee: Employee | null
  service: Service | null
  bookingType: BookingType | null
  durationOption: EmployeeDurationOption | null
  date: string
  slot: TimeSlot | null
  booking: Booking | null
  branch: PublicBranch | null
  couponCode: string | null
  couponId: string | null
  discountAmount: number
  paymentMethod: "moyasar" | "at_clinic" | "bank_transfer" | null
  showIntakePopup: boolean
}

/* ─── Hook ─── */

export function useWidgetBooking(
  initialEmployeeId?: string,
  initialServiceId?: string,
  flowOrder: BookingFlowOrder = "service_first",
  anyEmployee = false,
) {
  const [state, setState] = useState<WizardState>({
    step: "service",
    employee: null,
    service: null,
    bookingType: null,
    durationOption: null,
    date: "",
    slot: null,
    booking: null,
    branch: null,
    couponCode: null,
    couponId: null,
    discountAmount: 0,
    paymentMethod: null,
    showIntakePopup: false,
  })

  const queries = useWidgetBookingQueries(state, flowOrder)

  const { serviceTypes } = queries
  const activeServiceType = serviceTypes.find(
    (st) => st.bookingType === state.bookingType && st.isActive,
  )
  const durationOptions: EmployeeDurationOption[] =
    activeServiceType?.durationOptions ?? []

  const canFetchSlots =
    !!state.employee && !!state.date &&
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

  const selectEmployee = useCallback((p: Employee) => {
    setState((s) => ({
      ...s,
      employee: p,
      service: flowOrder === "employee_first" ? null : s.service,
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
      employee: null,
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
      if (!state.employee || !state.service || !state.bookingType || !state.date || !state.slot) return
      createMut.mutate({
        employeeId: state.employee.id,
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

  // When branches load and there are multiple, redirect "service" → "branch" automatically.
  // Use a derived value instead of setState-in-effect to avoid cascading renders.
  const effectiveStep: WizardStep =
    hasBranches && state.step === "service" && !state.branch ? "branch" : state.step

  const goBack = useCallback(() => {
    setState((s) => {
      const steps: WizardStep[] = hasBranches
        ? ["branch", "service", "datetime", "auth", "confirm"]
        : ["service", "datetime", "auth", "confirm"]
      // Use effectiveStep for back navigation so the branch redirect is respected
      const currentStep: WizardStep =
        hasBranches && s.step === "service" && !s.branch ? "branch" : s.step
      const idx = steps.indexOf(currentStep)
      if (idx <= 0) return s
      return { ...s, step: steps[idx - 1] }
    })
  }, [hasBranches])

  /* ─── Universal back — handles all sub-states ─── */
  const universalBack = useCallback(() => {
    setState((s) => {
      // Inside service step — handle sub-states first
      if ((s.step as string) === "service") {
        if (flowOrder === "service_first") {
          // booking type shown → go back to employee list
          if (s.employee && s.service) return { ...s, employee: null, bookingType: null, durationOption: null, slot: null }
          // employee list shown → go back to service list
          if (s.service && !s.employee) return { ...s, service: null, employee: null, bookingType: null, durationOption: null, slot: null }
        }
        if (flowOrder === "employee_first") {
          // booking type shown → go back to service list
          if (s.employee && s.service) return { ...s, service: null, bookingType: null, durationOption: null, slot: null }
          // service list shown → go back to employee list
          if (s.employee && !s.service) return { ...s, employee: null, bookingType: null, durationOption: null, slot: null }
        }
      }
      // Going back from confirm → skip auth (user is already authenticated, auth useEffect
      // would immediately fire onAuthComplete and jump back to confirm) → go to datetime
      if (s.step === "confirm") {
        return { ...s, step: "datetime" }
      }
      // Between main steps
      const steps: WizardStep[] = hasBranches
        ? ["branch", "service", "datetime", "auth", "confirm"]
        : ["service", "datetime", "auth", "confirm"]
      const currentStep: WizardStep =
        hasBranches && s.step === "service" && !s.branch ? "branch" : s.step
      const idx = steps.indexOf(currentStep)
      if (idx <= 0) return s
      return { ...s, step: steps[idx - 1] }
    })
  }, [hasBranches, flowOrder])

  // Sub-step back helpers (used inside "service" step)
  const clearEmployee = useCallback(() => {
    setState((s) => ({ ...s, employee: null, bookingType: null, durationOption: null, slot: null }))
  }, [])

  // Clears service + employee (go back to first sub-step)
  const clearService = useCallback(() => {
    setState((s) => ({ ...s, service: null, employee: null, bookingType: null, durationOption: null, slot: null }))
  }, [])

  // Clears service only — keeps employee (employee_first: go back from booking-type to service list)
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
  ) => {
    setState((s) => ({
      ...s,
      couponCode: code,
      discountAmount,
      couponId: couponId ?? null,
    }))
  }, [])

  const clearDiscount = useCallback(() => {
    setState((s) => ({
      ...s,
      couponCode: null,
      discountAmount: 0,
      couponId: null,
    }))
  }, [])

  const selectPaymentMethod = useCallback((method: "moyasar" | "at_clinic" | "bank_transfer") => {
    setState((s) => ({ ...s, paymentMethod: method }))
  }, [])

  const dismissIntakePopup = useCallback(() => {
    setState((s) => ({ ...s, showIntakePopup: false }))
  }, [])

  return {
    state: { ...state, step: effectiveStep },
    setState,
    flowOrder,
    ...queries,
    durationOptions,
    slots,
    slotsLoading,
    canFetchSlots,
    selectEmployee,
    selectService,
    selectServiceOnly,
    selectDateTime,
    onAuthComplete,
    confirmBooking,
    goBack,
    universalBack,
    isConfirming: createMut.isPending,
    confirmError: createMut.error,
    initialEmployeeId,
    initialServiceId,
    clearEmployee,
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
    anyEmployee,
  }
}
