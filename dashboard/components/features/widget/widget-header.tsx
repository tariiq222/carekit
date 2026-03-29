"use client"

/**
 * Widget Header — Clinic branding + step progress + close button
 */

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, ArrowRight01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { fetchWidgetBranding } from "@/lib/api/widget"
import { cn } from "@/lib/utils"
import type { WizardStep } from "@/hooks/use-widget-booking"

interface Props {
  locale: "ar" | "en"
  step: WizardStep
  stepIndex: number
  totalSteps: number
  onBack?: () => void
  onClose: () => void
}

export function WidgetHeader({ locale, step, stepIndex, totalSteps, onBack, onClose }: Props) {
  const isRtl = locale === "ar"
  const backIcon = isRtl ? ArrowRight01Icon : ArrowLeft01Icon

  const { data: branding } = useQuery({
    queryKey: ["widget", "branding"],
    queryFn: fetchWidgetBranding,
    staleTime: 10 * 60 * 1000,
  })

  const clinicName = isRtl
    ? (branding?.clinic_name ?? branding?.app_name ?? "")
    : (branding?.clinic_name_en ?? branding?.app_name_en ?? "")

  const STEP_LABELS: Record<WizardStep, { ar: string; en: string }> = {
    service:  { ar: "اختر الخدمة", en: "Select Service" },
    datetime: { ar: "اختر الموعد", en: "Choose Time" },
    auth:     { ar: "تسجيل الدخول", en: "Sign In" },
    confirm:  { ar: "تأكيد الحجز", en: "Confirm" },
    success:  { ar: "تم الحجز", en: "Confirmed" },
  }

  const stepLabel = STEP_LABELS[step]

  /* ─── Progress bar: only for service/datetime/auth/confirm (not success) ─── */
  const showProgress = step !== "success"
  const progress = showProgress ? ((stepIndex + 1) / totalSteps) * 100 : 100

  return (
    <div className="border-b border-border/50">
      {/* Clinic name row */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              aria-label={isRtl ? "رجوع" : "Back"}
            >
              <HugeiconsIcon icon={backIcon} size={16} />
            </button>
          )}
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={clinicName}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">{clinicName}</span>
          )}
        </div>

        <button
          onClick={onClose}
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
          aria-label={isRtl ? "إغلاق" : "Close"}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {/* Step label + progress */}
      <div className="px-5 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">
            {isRtl ? stepLabel.ar : stepLabel.en}
          </p>
          {showProgress && (
            <p className="text-xs text-muted-foreground">
              {stepIndex + 1} / {totalSteps}
            </p>
          )}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full bg-primary rounded-full transition-all duration-500")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
