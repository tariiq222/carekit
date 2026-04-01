"use client"

/**
 * Booking Wizard — CareKit Embeddable Widget
 *
 * Orchestrates the 4-step booking flow:
 * service → datetime → auth → confirm → success
 *
 * Communicates with the host page via postMessage.
 */

import { useEffect } from "react"
import { useWidgetBooking } from "@/hooks/use-widget-booking"
import { WidgetServiceStep } from "./widget-service-step"
import { WidgetDatetimeStep } from "./widget-datetime-step"
import { WidgetAuthStep } from "./widget-auth-step"
import { WidgetConfirmStep } from "./widget-confirm-step"
import { WidgetHeader } from "./widget-header"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/* ─── postMessage protocol ─── */

export type WidgetMessage =
  | { type: "carekit:booking:complete"; bookingId: string }
  | { type: "carekit:widget:close" }
  | { type: "carekit:widget:resize"; height: number }

export function postToHost(msg: WidgetMessage, targetOrigin: string) {
  if (typeof window !== "undefined" && window.parent !== window && targetOrigin) {
    window.parent.postMessage(msg, targetOrigin)
  }
}

/* ─── Step labels for progress indicator ─── */

const STEP_ORDER = ["service", "datetime", "auth", "confirm", "success"] as const

interface BookingWizardProps {
  initialPractitionerId?: string
  initialServiceId?: string
  initialLocale?: "ar" | "en"
  /** The origin of the parent page embedding this widget (e.g. "https://example.com"). Required for postMessage; messages are silently skipped when empty. */
  parentOrigin?: string
  initialFlowOrder?: "service_first" | "practitioner_first"
}

export function BookingWizard({
  initialPractitionerId,
  initialServiceId,
  initialLocale = "ar",
  parentOrigin = "",
  initialFlowOrder = "service_first",
}: BookingWizardProps) {
  const booking = useWidgetBooking(initialPractitionerId, initialServiceId, initialFlowOrder)
  const { state } = booking

  /* ─── Notify host of resize on step change ─── */
  useEffect(() => {
    const timer = setTimeout(() => {
      const height = document.documentElement.scrollHeight
      postToHost({ type: "carekit:widget:resize", height }, parentOrigin)
    }, 100)
    return () => clearTimeout(timer)
  }, [state.step, parentOrigin])

  /* ─── Notify host when booking complete ─── */
  useEffect(() => {
    if (state.step === "success" && state.booking) {
      postToHost({ type: "carekit:booking:complete", bookingId: state.booking.id }, parentOrigin)
    }
  }, [state.step, state.booking, parentOrigin])

  /* ─── Listen for config from host ─── */
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (parentOrigin !== "*" && event.origin !== parentOrigin) return
      if (event.data?.type === "carekit:widget:config") {
        // Future: handle pre-selection config from host
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [parentOrigin])

  const stepIndex = STEP_ORDER.indexOf(state.step)

  return (
    <Card className="glass-solid overflow-hidden shadow-xl border-border/50">
      <WidgetHeader
        locale={initialLocale}
        step={state.step}
        stepIndex={stepIndex}
        totalSteps={4}
        onBack={state.step !== "service" && state.step !== "success" ? booking.goBack : undefined}
        onClose={() => postToHost({ type: "carekit:widget:close" }, parentOrigin)}
      />

      <div className={cn("p-5", state.step === "success" && "pb-8")}>
        {state.step === "service" && (
          <WidgetServiceStep
            locale={initialLocale}
            booking={booking}
            flowOrder={initialFlowOrder}
          />
        )}

        {state.step === "datetime" && (
          <WidgetDatetimeStep
            locale={initialLocale}
            booking={booking}
          />
        )}

        {state.step === "auth" && (
          <WidgetAuthStep
            locale={initialLocale}
            onAuthComplete={booking.onAuthComplete}
          />
        )}

        {(state.step === "confirm" || state.step === "success") && (
          <WidgetConfirmStep
            locale={initialLocale}
            booking={booking}
          />
        )}
      </div>
    </Card>
  )
}
