"use client"

import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useVerticals } from "@/hooks/use-verticals"

export interface Step1Data {
  businessNameAr: string
  businessNameEn: string
  verticalSlug: string
}

interface Props {
  data: Step1Data
  onChange: (data: Step1Data) => void
  onNext: () => void
}

export function OnboardingStep1Business({ data, onChange, onNext }: Props) {
  const { t } = useLocale()
  const { data: verticals = [], isLoading } = useVerticals()

  const isValid = data.businessNameAr.trim().length >= 2 && data.verticalSlug.length > 0

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step1.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-nameAr">{t("onboarding.step1.businessNameAr")}</Label>
        <Input
          id="ob-nameAr"
          value={data.businessNameAr}
          onChange={(e) => onChange({ ...data, businessNameAr: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-nameEn">{t("onboarding.step1.businessNameEn")}</Label>
        <Input
          id="ob-nameEn"
          value={data.businessNameEn}
          onChange={(e) => onChange({ ...data, businessNameEn: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-vertical">{t("onboarding.step1.vertical")}</Label>
        <select
          id="ob-vertical"
          value={data.verticalSlug}
          onChange={(e) => onChange({ ...data, verticalSlug: e.target.value })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          disabled={isLoading}
        >
          <option value="">{t("onboarding.step1.verticalPlaceholder")}</option>
          {verticals.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.nameAr}
            </option>
          ))}
        </select>
      </div>

      <Button className="w-full" onClick={onNext} disabled={!isValid}>
        {t("onboarding.next")}
      </Button>
    </div>
  )
}
