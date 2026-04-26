"use client"

import { Button } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

interface Props {
  onStart: () => void
  onBack: () => void
  isLoading: boolean
}

export function OnboardingStep4Confirm({ onStart, onBack, isLoading }: Props) {
  const { t } = useLocale()

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/10">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("onboarding.step4.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("onboarding.step4.trialInfo")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button className="w-full" onClick={onStart} disabled={isLoading}>
          {isLoading ? t("onboarding.saving") : t("onboarding.step4.start")}
        </Button>
        <Button variant="outline" className="w-full" onClick={onBack} disabled={isLoading}>
          {t("onboarding.back")}
        </Button>
      </div>
    </div>
  )
}
