"use client"

import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { CreateGroupSessionFormValues, SessionWizardStep } from "@/lib/schemas/group-sessions.schema"
import { stepFields } from "@/lib/schemas/group-sessions.schema"
import { SessionStepInfo } from "./session-step-info"
import { SessionStepSettings } from "./session-step-settings"
import { SessionStepScheduling } from "./session-step-scheduling"
import { SessionStepReview } from "./session-step-review"

interface Props {
  form: UseFormReturn<CreateGroupSessionFormValues>
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "block rounded-full transition-all duration-200",
            i + 1 === current
              ? "h-2.5 w-8 bg-primary"
              : i + 1 < current
              ? "h-2.5 w-2.5 bg-primary/50"
              : "h-2.5 w-2.5 bg-border",
          )}
        />
      ))}
    </div>
  )
}

const TOTAL_STEPS = 4

export function SessionWizard({ form, onSubmit, onCancel, isPending }: Props) {
  const { t } = useLocale()
  const [currentStep, setCurrentStep] = useState<SessionWizardStep>(1)

  const stepTitles: Record<SessionWizardStep, string> = {
    1: t("groupSessions.wizard.step1.title"),
    2: t("groupSessions.wizard.step2.title"),
    3: t("groupSessions.wizard.step3.title"),
    4: t("groupSessions.wizard.step4.title"),
  }

  const goNext = async () => {
    const fields = stepFields[currentStep]
    if (fields.length > 0) {
      const valid = await form.trigger(fields as Array<keyof CreateGroupSessionFormValues>)
      if (!valid) return
    }
    if (currentStep < 4) setCurrentStep((currentStep + 1) as SessionWizardStep)
  }

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as SessionWizardStep)
  }

  const goToStep = (step: SessionWizardStep) => setCurrentStep(step)

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-3 px-1 pb-4">
        {currentStep > 1 ? (
          <Button variant="ghost" size="icon-sm" type="button" onClick={goBack} className="shrink-0">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" type="button" onClick={onCancel} className="shrink-0">
            <span className="text-base leading-none">✕</span>
          </Button>
        )}
        <p className="flex-1 text-center text-base font-bold text-foreground">
          {stepTitles[currentStep]}
        </p>
        <div className="w-9" />
      </div>

      <div className="pb-4">
        <StepDots current={currentStep} total={TOTAL_STEPS} />
      </div>

      <div className="flex flex-col gap-6 pb-6">
        {currentStep === 1 && <SessionStepInfo form={form} />}
        {currentStep === 2 && <SessionStepSettings form={form} />}
        {currentStep === 3 && <SessionStepScheduling form={form} />}
        {currentStep === 4 && <SessionStepReview form={form} onGoToStep={goToStep} />}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        {currentStep > 1 && (
          <Button variant="outline" type="button" onClick={goBack}>
            {t("groupSessions.wizard.back")}
          </Button>
        )}
        <div className="ms-auto">
          {currentStep < 4 ? (
            <Button type="button" onClick={goNext}>
              {t("groupSessions.wizard.next")}
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={isPending}>
              {isPending ? t("common.saving") : t("groupSessions.wizard.submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
