"use client"

/**
 * Booking Wizard — CareKit Embeddable Widget
 *
 * Two-column layout: steps sidebar (left) + content area (right)
 * Communicates with the host page via postMessage.
 *
 * Branding: fetches primary_color + secondary_color from /whitelabel/public
 * and injects them as CSS variables so the widget matches the clinic's brand.
 */

import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWidgetBooking } from "@/hooks/use-widget-booking"
import { WidgetServiceStep } from "./widget-service-step"
import { WidgetDatetimeStep } from "./widget-datetime-step"
import { WidgetAuthStep } from "./widget-auth-step"
import { WidgetConfirmStep } from "./widget-confirm-step"
import { WidgetBranchStep } from "./widget-branch-step"
import { WidgetStepsSidebar } from "./widget-steps-sidebar"
import { WidgetIntakePopup } from "./widget-intake-popup"
import type { StepDef } from "./widget-steps-sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { BookingFlowOrder } from "@/lib/api/clinic-settings"
import { fetchWidgetBranding } from "@/lib/api/widget"
import { deriveCssVars, buildStyleFromVars, isValidHex } from "@/lib/color-utils"
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

/* ─── Props ─── */

interface BookingWizardProps {
  initialPractitionerId?: string
  initialServiceId?: string
  initialLocale?: "ar" | "en"
  /** The origin of the parent page embedding this widget. Required for postMessage. */
  parentOrigin?: string
  initialFlowOrder?: BookingFlowOrder
}

export function BookingWizard({
  initialPractitionerId,
  initialServiceId,
  initialLocale = "ar",
  parentOrigin = "",
  initialFlowOrder = "service_first",
}: BookingWizardProps) {
  /* ─── Branding ─── */
  const { data: branding } = useQuery({
    queryKey: ["widget", "branding"],
    queryFn: fetchWidgetBranding,
    staleTime: 10 * 60 * 1000,
  })

  /* ─── Derive CSS vars from clinic colors ─── */
  const brandingStyle = useMemo(() => {
    const primary = branding?.primary_color
    const accent = branding?.secondary_color
    if (!primary || !isValidHex(primary)) return {}
    const derived = deriveCssVars({
      primary,
      accent: accent && isValidHex(accent) ? accent : primary,
    })
    return buildStyleFromVars(derived.light)
  }, [branding])

  /* ─── Widget settings from branding ─── */
  const widgetShowPrice         = branding?.widget_show_price ?? true
  const widgetAnyPractitioner   = branding?.widget_any_practitioner ?? false
  const widgetRedirectUrl       = branding?.widget_redirect_url ?? null
  const widgetMaxAdvanceDays    = typeof branding?.widget_max_advance_days === 'number'
    ? branding.widget_max_advance_days
    : Number(branding?.widget_max_advance_days ?? 0)

  /* ─── Booking state machine ─── */
  const booking = useWidgetBooking(
    initialPractitionerId,
    initialServiceId,
    initialFlowOrder,
    widgetAnyPractitioner,
  )
  const { state, hasBranches, universalBack } = booking
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

  /* ─── Redirect after success (respects intake popup) ─── */
  function handleIntakeDismiss() {
    booking.dismissIntakePopup()
    if (widgetRedirectUrl) {
      setTimeout(() => { window.location.href = widgetRedirectUrl }, 300)
    }
  }

  /* ─── Redirect after success when no intake popup ─── */
  useEffect(() => {
    if (
      state.step === "success" &&
      !state.showIntakePopup &&
      widgetRedirectUrl
    ) {
      const timer = setTimeout(() => { window.location.href = widgetRedirectUrl }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state.step, state.showIntakePopup, widgetRedirectUrl])

  const isSuccess = state.step === "success"

  /* ─── Step title per step ─── */
  const STEP_TITLES: Record<string, { ar: string; en: string }> = {
    branch:   { ar: "اختر الفرع",           en: "Select Branch" },
    service:  { ar: "اختر الخدمة",          en: "Select Service" },
    datetime: { ar: "اختر التاريخ والوقت",  en: "Select Date & Time" },
    auth:     { ar: "بياناتك",              en: "Your Details" },
    confirm:  { ar: "تأكيد الحجز",          en: "Confirm Booking" },
    success:  { ar: "تم الحجز",             en: "Booking Confirmed" },
  }
  const stepTitle = STEP_TITLES[state.step]

  /* ─── Show back button logic ─── */
  const canGoBack = !isSuccess && !(
    // First real step with no sub-state
    (state.step === "branch") ||
    (state.step === "service" && !state.practitioner && !state.service && !hasBranches) ||
    (state.step === "service" && !state.service && !state.practitioner && hasBranches && !state.branch)
  )

  return (
    <>
    <Card
      className={cn(
        "glass-solid overflow-hidden shadow-xl border-border/50",
        "flex flex-col w-full min-h-[680px]",
      )}
      dir={isRtl ? "rtl" : "ltr"}
      style={brandingStyle}
    >
{/* Steps bar — horizontal, below header */}
      {!isSuccess && (
        <WidgetStepsSidebar
          locale={initialLocale}
          step={state.step}
          steps={VISIBLE_STEPS}
        />
      )}

      {/* Body: content only */}
      <div className="flex flex-1 min-h-0">
        {/* Content area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden w-full">
          {/* Step title */}
          {stepTitle && !isSuccess && (
            <div className="px-6 pt-5 pb-0">
              <h2 className="text-base font-semibold text-foreground">
                {isRtl ? stepTitle.ar : stepTitle.en}
              </h2>
            </div>
          )}
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
                anyPractitioner={widgetAnyPractitioner}
              />
            )}

            {state.step === "datetime" && (
              <WidgetDatetimeStep
                locale={initialLocale}
                booking={booking}
                maxAdvanceDays={widgetMaxAdvanceDays}
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
                showPrice={widgetShowPrice}
                redirectUrl={widgetRedirectUrl}
              />
            )}
          </div>

          {/* Unified footer — back + next for all steps except datetime (has its own next) and success */}
          {/* RTL: back is first in DOM → right side; next is second in DOM → left side */}
          {!isSuccess && state.step !== "datetime" && (
            <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-border/50">
              {/* Back button — first in DOM = right in RTL */}
              {canGoBack ? (
                <Button variant="outline" onClick={universalBack} className="min-w-24">
                  {isRtl ? "رجوع" : "Back"}
                </Button>
              ) : (
                <div />
              )}

              {/* Next button — second in DOM = left in RTL; only on service booking-type sub-state */}
              {state.step === "service" && state.practitioner && state.service ? (
                <Button
                  onClick={() => {
                    if (state.bookingType && state.service) {
                      booking.selectService(state.service, state.bookingType)
                    }
                  }}
                  disabled={!state.bookingType}
                  className="min-w-28"
                >
                  {isRtl ? "التالي" : "Next"}
                </Button>
              ) : (
                <div />
              )}
            </div>
          )}
        </div>
      </div>
    </Card>

    {/* Post-booking intake form popup */}
    {state.showIntakePopup && state.booking?.intakeFormId && (
      <WidgetIntakePopup
        locale={initialLocale}
        formId={state.booking.intakeFormId}
        bookingId={state.booking.id}
        onDismiss={handleIntakeDismiss}
      />
    )}
    </>
  )
}
