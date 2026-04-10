"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { CourseFormValues, CourseWizardStep } from "@/lib/schemas/courses.schema"
import { stepFields } from "@/lib/schemas/courses.schema"
import { CourseStepInfo } from "./course-step-info"
import { CourseStepSessions } from "./course-step-sessions"
import { CourseStepPricing } from "./course-step-pricing"
import { CourseStepReview } from "./course-step-review"

interface Props {
  form: UseFormReturn<CourseFormValues>
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

interface StepTabsProps {
  current: number
  steps: { label: string; description: string }[]
}

function StepTabs({ current, steps }: StepTabsProps) {
  return (
    <div className="flex w-full">
      {steps.map((step, i) => {
        const stepNum = i + 1
        const isCompleted = stepNum < current
        const isActive = stepNum === current

        return (
          <div key={i} className="flex flex-1 flex-col">
            {/* Tab content */}
            <div
              className={cn(
                "flex flex-col gap-0.5 px-3 pb-3 pt-1 transition-colors duration-200",
                isActive ? "opacity-100" : "opacity-50",
              )}
            >
              {/* Step number + label row */}
              <div className="flex items-center gap-2">
                {/* Step number badge */}
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-200",
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-border text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </span>

                {/* Step label */}
                <span
                  className={cn(
                    "text-xs font-semibold leading-tight transition-colors duration-200",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Step description — shown only on active step */}
              {isActive && (
                <p className="ps-7 text-[11px] leading-tight text-muted-foreground">
                  {step.description}
                </p>
              )}
            </div>

            {/* Active indicator bar */}
            <div
              className={cn(
                "h-0.5 w-full rounded-full transition-all duration-300",
                isCompleted
                  ? "bg-primary/40"
                  : isActive
                  ? "bg-primary"
                  : "bg-border",
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

const TOTAL_STEPS = 4

export function CourseWizard({ form, onSubmit, onCancel, isPending }: Props) {
  const { t } = useLocale()
  const [currentStep, setCurrentStep] = useState<CourseWizardStep>(1)

  const steps = [
    { label: t("courses.wizard.step1"), description: t("courses.wizard.step1Desc") },
    { label: t("courses.wizard.step2"), description: t("courses.wizard.step2Desc") },
    { label: t("courses.wizard.step3"), description: t("courses.wizard.step3Desc") },
    { label: t("courses.wizard.step4"), description: t("courses.wizard.step4Desc") },
  ]

  const goNext = async () => {
    const fields = stepFields[currentStep]
    if (fields.length > 0) {
      const valid = await form.trigger(fields as Array<keyof CourseFormValues>)
      if (!valid) return
    }
    if (currentStep < TOTAL_STEPS) setCurrentStep((currentStep + 1) as CourseWizardStep)
  }

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as CourseWizardStep)
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Step tabs header */}
      <div className="mb-6">
        <StepTabs current={currentStep} steps={steps} />
      </div>

      {/* Step content */}
      <div className="flex flex-col gap-6 pb-6">
        {currentStep === 1 && <CourseStepInfo form={form} />}
        {currentStep === 2 && <CourseStepSessions form={form} />}
        {currentStep === 3 && <CourseStepPricing form={form} />}
        {currentStep === 4 && (
          <CourseStepReview form={form} onGoToStep={setCurrentStep} />
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 border-t border-border pt-4">
        {currentStep > 1 ? (
          <Button variant="outline" type="button" onClick={goBack}>
            {t("courses.wizard.back")}
          </Button>
        ) : (
          <Button variant="ghost" type="button" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <div className="ms-auto">
          {currentStep < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext}>
              {t("courses.wizard.next")}
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={isPending}>
              {isPending ? t("common.saving") : t("courses.wizard.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
