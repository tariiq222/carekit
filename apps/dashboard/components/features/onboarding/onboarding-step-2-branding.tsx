"use client"

import { Button, Input, Label } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

export interface Step2Data {
  primaryColor: string
  logoUrl: string
}

interface Props {
  data: Step2Data
  onChange: (data: Step2Data) => void
  onNext: () => void
  onBack: () => void
}

export function OnboardingStep2Branding({ data, onChange, onNext, onBack }: Props) {
  const { t } = useLocale()

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step2.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-color">{t("onboarding.step2.primaryColor")}</Label>
        <div className="flex items-center gap-3">
          <input
            id="ob-color"
            type="color"
            value={data.primaryColor || "#354FD8"}
            onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
            className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-background"
          />
          <Input
            value={data.primaryColor || "#354FD8"}
            onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
            className="flex-1 font-mono"
            maxLength={7}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("onboarding.step2.logo")}</Label>
        <p className="text-xs text-muted-foreground">{t("onboarding.step2.logoHint")}</p>
        <Button variant="outline" type="button" className="w-full">
          {t("onboarding.step2.uploadLogo")}
        </Button>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button className="flex-1" onClick={onNext}>
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  )
}
