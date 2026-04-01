"use client"

/**
 * Widget Steps Sidebar — vertical step list with numbered indicators
 * Accepts a dynamic steps array to support optional branch step.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { WizardStep } from "@/hooks/use-widget-booking"

export interface StepDef {
  key: WizardStep
  labelAr: string
  labelEn: string
}

interface Props {
  locale: "ar" | "en"
  step: WizardStep
  steps: StepDef[]
}

export function WidgetStepsSidebar({ locale, step, steps }: Props) {
  const isRtl = locale === "ar"
  const stepIndex = steps.findIndex((s) => s.key === step)

  return (
    <aside
      className={cn(
        "w-48 shrink-0 flex flex-col gap-1 py-6 px-5",
        "bg-surface-muted/60",
        "border-e border-border/50",
      )}
    >
      <div className="flex flex-col gap-3 mt-1">
        {steps.map((s, idx) => {
          const isCompleted = idx < stepIndex
          const isActive = s.key === step
          const isPending = idx > stepIndex

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "bg-primary text-primary-foreground",
                  isPending && "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <HugeiconsIcon icon={Tick01Icon} size={14} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors leading-tight",
                  isActive && "text-foreground font-semibold",
                  isCompleted && "text-foreground/70 font-medium",
                  isPending && "text-muted-foreground/50",
                )}
              >
                {isRtl ? s.labelAr : s.labelEn}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
