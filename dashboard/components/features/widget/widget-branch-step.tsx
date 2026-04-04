"use client"

/**
 * Widget Branch Step — select clinic branch before booking
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Location01Icon, Call02Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { PublicBranch } from "@/lib/api/widget"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
}

export function WidgetBranchStep({ locale, booking }: Props) {
  const { branches, branchesLoading, selectBranch, state } = booking
  const isRtl = locale === "ar"

  if (branchesLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <HugeiconsIcon icon={Loading03Icon} size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
<div className="grid gap-3">
        {branches.map((branch: PublicBranch) => {
          const isSelected = state.branch?.id === branch.id
          const name = isRtl ? branch.nameAr : branch.nameEn

          return (
            <button
              key={branch.id}
              onClick={() => selectBranch(branch)}
              className={cn(
                "w-full text-start rounded-xl border p-4 transition-all",
                "hover:border-primary/60 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border/60 bg-surface",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <HugeiconsIcon icon={Building01Icon} size={18} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-sm text-foreground">{name}</p>
                  {branch.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={Location01Icon} size={12} />
                      {branch.address}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={Call02Icon} size={12} />
                      {branch.phone}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
