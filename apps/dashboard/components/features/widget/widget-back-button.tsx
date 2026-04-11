"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

export function WidgetBackButton({ isRtl, onClick }: { isRtl: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <HugeiconsIcon
        icon={isRtl ? ArrowRight01Icon : ArrowLeft01Icon}
        size={15}
      />
      {isRtl ? "رجوع" : "Back"}
    </button>
  )
}
