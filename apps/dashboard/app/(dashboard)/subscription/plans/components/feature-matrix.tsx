"use client"

import { Card } from "@deqah/ui"
import { getLocalizedPlanName } from "@/lib/billing/utils"
import type { Plan } from "@/lib/types/billing"

interface FeatureMatrixProps {
  plans: Plan[]
  locale: "ar" | "en"
  t: (key: string) => string
}

const FEATURES = [
  { key: "maxEmployees", label: "billing.plans.employees" },
  { key: "chatbotEnabled", label: "billing.plans.chatbot" },
  { key: "zatcaEnabled", label: "billing.plans.zatca" },
] as const

export function FeatureMatrix({ plans, locale, t }: FeatureMatrixProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        {t("billing.plans.features")}
      </h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 text-start text-muted-foreground">
                {t("billing.plans.features")}
              </th>
              {plans.map((plan) => (
                <th key={plan.id} className="p-4 text-start text-foreground">
                  {getLocalizedPlanName(plan, locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feature) => (
              <tr key={feature.key} className="border-b border-border last:border-b-0">
                <td className="p-4 font-medium text-foreground">{t(feature.label)}</td>
                {plans.map((plan) => (
                  <td key={`${plan.id}-${feature.key}`} className="p-4 text-muted-foreground">
                    {formatLimit(plan.limits[feature.key], t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  )
}

function formatLimit(value: number | boolean | undefined, t: (key: string) => string) {
  if (value === true) return t("billing.plans.included")
  if (value === false) return t("billing.plans.notIncluded")
  if (value === -1) return t("billing.usage.unlimited")
  return value?.toString() ?? "-"
}
