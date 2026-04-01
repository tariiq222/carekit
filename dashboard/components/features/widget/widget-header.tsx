"use client"

/**
 * Widget Header — Clinic branding + close button only
 * Steps progress is handled by WidgetStepsSidebar
 */

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { fetchWidgetBranding } from "@/lib/api/widget"

interface Props {
  locale: "ar" | "en"
  onClose: () => void
}

export function WidgetHeader({ locale, onClose }: Props) {
  const isRtl = locale === "ar"

  const { data: branding } = useQuery({
    queryKey: ["widget", "branding"],
    queryFn: fetchWidgetBranding,
    staleTime: 10 * 60 * 1000,
  })

  const clinicName = isRtl
    ? (branding?.clinic_name ?? branding?.app_name ?? "")
    : (branding?.clinic_name_en ?? branding?.app_name_en ?? "")

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-surface">
      {/* Clinic branding */}
      <div className="flex items-center gap-2">
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

      {/* Close */}
      <button
        onClick={onClose}
        className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
        aria-label={isRtl ? "إغلاق" : "Close"}
      >
        <HugeiconsIcon icon={Cancel01Icon} size={16} />
      </button>
    </div>
  )
}
