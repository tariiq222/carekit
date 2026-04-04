"use client"

/**
 * Widget Steps Bar — horizontal progress steps in header
 * Replaces the vertical sidebar
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
    <div className="flex items-center justify-center gap-0 px-6 py-3 bg-transparent">
      {steps.map((s, idx) => {
        const isCompleted = idx < stepIndex
        const isActive = s.key === step
        const isPending = idx > stepIndex
        const isLast = idx === steps.length - 1

        return (
          <div key={s.key} className="flex items-center">
            {/* Step item */}
            <div className="flex flex-col items-center gap-1">
              {/* Circle */}
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all",
                isCompleted && "bg-primary text-primary-foreground",
                isActive && "bg-primary text-primary-foreground",
                isPending && "bg-muted-foreground/15 text-muted-foreground",
              )}>
                {isCompleted
                  ? <HugeiconsIcon icon={Tick01Icon} size={13} />
                  : <span>{idx + 1}</span>
                }
              </div>
              {/* Label */}
              <span className={cn(
                "text-xs leading-none whitespace-nowrap transition-colors",
                isActive && "text-foreground font-semibold",
                isCompleted && "text-muted-foreground font-medium",
                isPending && "text-muted-foreground/40",
              )}>
                {isRtl ? s.labelAr : s.labelEn}
              </span>
            </div>

            {/* Connector line between steps */}
            {!isLast && (
              <div className={cn(
                "h-px w-8 mx-1 mb-4 transition-colors",
                isCompleted ? "bg-primary" : "bg-border",
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
