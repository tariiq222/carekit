"use client"

import { Button, Input, Label } from "@carekit/ui"
import { useLocale } from "@/components/locale-provider"

export interface DayHours {
  enabled: boolean
  open: string
  close: string
}

export interface Step3Data {
  branchName: string
  city: string
  hours: Record<number, DayHours>
}

const defaultHours = (): Record<number, DayHours> =>
  Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: d >= 0 && d <= 4, open: "09:00", close: "18:00" }])
  )

export const defaultStep3Data: Step3Data = {
  branchName: "",
  city: "",
  hours: defaultHours(),
}

interface Props {
  data: Step3Data
  onChange: (data: Step3Data) => void
  onNext: () => void
  onBack: () => void
}

export function OnboardingStep3Branch({ data, onChange, onNext, onBack }: Props) {
  const { t } = useLocale()

  const isValid = data.branchName.trim().length >= 2 && data.city.trim().length >= 2

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("onboarding.step3.title")}</h2>

      <div className="space-y-1">
        <Label htmlFor="ob-branch">{t("onboarding.step3.branchName")}</Label>
        <Input
          id="ob-branch"
          value={data.branchName}
          onChange={(e) => onChange({ ...data, branchName: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ob-city">{t("onboarding.step3.city")}</Label>
        <Input
          id="ob-city"
          value={data.city}
          onChange={(e) => onChange({ ...data, city: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("onboarding.step3.businessHours")}</Label>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const h = data.hours[day]
          return (
            <div key={day} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={h.enabled}
                onChange={(e) =>
                  onChange({
                    ...data,
                    hours: { ...data.hours, [day]: { ...h, enabled: e.target.checked } },
                  })
                }
                className="size-4 cursor-pointer"
              />
              <span className="w-20 text-sm text-foreground">{t(`onboarding.step3.day.${day}`)}</span>
              {h.enabled && (
                <>
                  <Input
                    type="time"
                    value={h.open}
                    onChange={(e) =>
                      onChange({ ...data, hours: { ...data.hours, [day]: { ...h, open: e.target.value } } })
                    }
                    className="w-28"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="time"
                    value={h.close}
                    onChange={(e) =>
                      onChange({ ...data, hours: { ...data.hours, [day]: { ...h, close: e.target.value } } })
                    }
                    className="w-28"
                  />
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          {t("onboarding.back")}
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={!isValid}>
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  )
}
