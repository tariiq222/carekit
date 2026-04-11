"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/components/locale-provider"
import type { DraftService } from "./services-tab"

/* ─── Booking type labels ─── */

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  in_person: { en: "In Person", ar: "حضوري" },
  online: { en: "Online", ar: "عن بعد" },
}

/* ─── Props ─── */

interface ServiceSummaryCardProps {
  draft: DraftService
  onRemove: () => void
}

/* ─── Component ─── */

export function ServiceSummaryCard({ draft, onRemove }: ServiceSummaryCardProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  return (
    <div className="flex items-start justify-between rounded-lg border border-border p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">
          {draft.serviceName}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {draft.availableTypes.map((bt) => (
            <Badge key={bt} variant="secondary" className="text-[10px]">
              {isAr
                ? TYPE_LABELS[bt]?.ar ?? bt
                : TYPE_LABELS[bt]?.en ?? bt}
            </Badge>
          ))}
        </div>
        {draft.bufferMinutes > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {t("employees.services.buffer").replace("{minutes}", String(draft.bufferMinutes))}
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
      </Button>
    </div>
  )
}
