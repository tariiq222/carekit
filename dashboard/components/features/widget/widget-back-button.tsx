"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

export function WidgetBackButton({ isRtl, onClick }: { isRtl: boolean; onClick: () => void }) {
  const icon = isRtl ? ArrowLeft01Icon : ArrowRight01Icon
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
    >
      <HugeiconsIcon icon={icon} size={14} />
      {isRtl ? "رجوع" : "Back"}
    </button>
  )
}
