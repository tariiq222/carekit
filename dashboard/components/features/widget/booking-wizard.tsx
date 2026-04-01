"use client"

/**
 * Booking Wizard — CareKit Embeddable Widget
 *
 * Two-column layout: steps sidebar (left) + content area (right)
 * Communicates with the host page via postMessage.
 */

import { useEffect } from "react"
import { useWidgetBooking } from "@/hooks/use-widget-booking"
import { WidgetServiceStep } from "./widget-service-step"
import { WidgetDatetimeStep } from "./widget-datetime-step"
import { WidgetAuthStep } from "./widget-auth-step"
import { WidgetConfirmStep } from "./widget-confirm-step"
import { WidgetBranchStep } from "./widget-branch-step"
import { WidgetHeader } from "./widget-header"
import { WidgetStepsSidebar } from "./widget-steps-sidebar"
import type { StepDef } from "./widget-steps-sidebar"
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


interface BookingWizardProps {
  initialPractitionerId?: string
  initialServiceId?: string
  initialLocale?: "ar" | "en"
  /** The origin of the parent page embedding this widget. Required for postMessage; silently skipped when empty. */
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
  const { state, hasBranches } = booking
  const isRtl = initialLocale === "ar"

  const VISIBLE_STEPS: StepDef[] = [
    ...(hasBranches ? [{ key: "branch" as const, labelAr: "الفرع", labelEn: "Branch" }] : []),
    { key: "service" as const, labelAr: "الخدمة", labelEn: "Service" },
    { key: "datetime" as const, labelAr: "الموعد", labelEn: "Date & Time" },
    { key: "auth" as const, labelAr: "تسجيل", labelEn: "Information" },
    { key: "confirm" as const, labelAr: "التأكيد", labelEn: "Confirmation" },
  ]

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

  const isSuccess = state.step === "success"

  return (
    <Card
      className={cn(
        "glass-solid overflow-hidden shadow-xl border-border/50",
        "flex flex-col w-full min-h-[680px]",
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Top header: clinic branding + close */}
      <WidgetHeader
        locale={initialLocale}
        onClose={() => postToHost({ type: "carekit:widget:close" }, parentOrigin)}
      />

      {/* Body: sidebar + content */}
      <div className="flex flex-1 min-h-0">
        {/* Steps sidebar */}
        {!isSuccess && (
          <WidgetStepsSidebar
            locale={initialLocale}
            step={state.step}
            steps={VISIBLE_STEPS}
          />
        )}

        {/* Content area */}
        <div className={cn("flex flex-col flex-1 min-w-0 overflow-hidden", isSuccess && "w-full")}>
          <div className={cn("flex-1 p-6 overflow-y-auto", isSuccess && "pb-8")}>
            {state.step === "branch" && (
              <WidgetBranchStep
                locale={initialLocale}
                booking={booking}
              />
            )}

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
        </div>
      </div>
    </Card>
  )
}
